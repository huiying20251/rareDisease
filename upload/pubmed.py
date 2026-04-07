"""
PubMed文献检索模块
"""

import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
import asyncio

logger = logging.getLogger(__name__)


@dataclass
class PubMedArticle:
    """PubMed文章"""
    pmid: str
    title: str
    abstract: Optional[str]
    authors: List[str]
    publication_date: Optional[str]
    journal: Optional[str]
    pmc_id: Optional[str]  # PubMed Central ID (开放获取)
    doi: Optional[str]
    keywords: List[str]

    # 检索匹配信息
    match_type: str = ""  # exact_title, exact_abstract, partial
    relevance_score: float = 0.0


class PubMedSearch:
    """PubMed文献检索"""

    BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    SEARCH_URL = f"{BASE_URL}/esearch.fcgi"
    FETCH_URL = f"{BASE_URL}/efetch.fcgi"
    SUMMARY_URL = f"{BASE_URL}/esummary.fcgi"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        pubmed_config = self.config.get("pubmed", {})

        self.email = pubmed_config.get("email", "example@example.com")
        self.api_key = pubmed_config.get("api_key", "")
        self.rate_limit = pubmed_config.get("rate_limit", 3)  # 无API key: 3/min
        self.max_results = pubmed_config.get("max_results", 100)
        self.last_request_time = 0

    async def search(self, queries: List[str], search_type: str = "all") -> List[PubMedArticle]:
        """
        搜索PubMed文献

        Args:
            queries: 查询词列表
            search_type: 搜索类型 (all, title, abstract, full)

        Returns:
            PubMed文章列表
        """
        logger.info(f"Searching PubMed with queries: {queries}")

        # 构建组合查询
        query_string = self._build_query(queries, search_type)

        # 执行搜索
        pmids = await self._search_pmids(query_string)

        if not pmids:
            logger.warning("No PMIDs found")
            return []

        # 获取文章详情
        articles = await self._fetch_articles(pmids)

        return articles

    def _build_query(self, queries: List[str], search_type: str) -> str:
        """构建查询字符串

        使用OR组合策略，最大化召回率：
        - 每个查询词单独搜索标题+摘要+补充材料
        - 所有查询词用OR连接，找包含任一关键词的文章

        示例（输入rs12345，解析为BRCA1 c.234C>G）：
        (BRCA1[Title/Abstract]) OR (BRCA1[Supplement])
        OR (BRCA1:c.234C>G[Title/Abstract]) OR (BRCA1:c.234C>G[Supplement])
        OR (rs12345[Title/Abstract]) OR (rs12345[Supplement])
        """
        query_parts = []

        for query in queries:
            if search_type == "title":
                query_parts.append(f'{query}[Title]')
            elif search_type == "abstract":
                query_parts.append(f'{query}[Abstract]')
            elif search_type == "full":
                # 每个查询词搜索标题+摘要+补充材料，用OR连接
                query_parts.append(
                    f'({query}[Title]) OR ({query}[Abstract]) OR ({query}[Supplement])'
                )
            else:  # all
                # 每个查询词搜索标题+摘要+补充材料，用OR连接
                query_parts.append(
                    f'({query}[Title/Abstract]) OR ({query}[Supplement])'
                )

        # 所有查询词用OR连接，最大化召回率
        return " OR ".join(query_parts)

    async def _search_pmids(self, query: str) -> List[str]:
        """搜索PMID列表"""
        import aiohttp

        params = {
            "db": "pubmed",
            "term": query,
            "retmax": self.max_results,
            "retmode": "json",
            "email": self.email,
            "sort": "relevance"
        }

        if self.api_key:
            params["api_key"] = self.api_key

        await self._rate_limit()

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.SEARCH_URL, params=params) as response:
                    if response.status != 200:
                        logger.error(f"PubMed search failed: {response.status}")
                        return []

                    data = await response.json()
                    id_list = data.get("esearchresult", {}).get("IdList", [])
                    logger.info(f"Found {len(id_list)} PMIDs")
                    return id_list

        except Exception as e:
            logger.error(f"PubMed search error: {e}")
            return []

    async def _fetch_articles(self, pmids: List[str]) -> List[PubMedArticle]:
        """获取文章详情"""
        import aiohttp

        if not pmids:
            return []

        await self._rate_limit()

        params = {
            "db": "pubmed",
            "id": ",".join(pmids),
            "retmode": "xml",
            "rettype": "abstract"
        }

        if self.api_key:
            params["api_key"] = self.api_key

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.FETCH_URL, params=params) as response:
                    if response.status != 200:
                        logger.error(f"PubMed fetch failed: {response.status}")
                        return []

                    text = await response.text()
                    return self._parse_pubmed_xml(text, pmids)

        except Exception as e:
            logger.error(f"PubMed fetch error: {e}")
            return []

    def _parse_pubmed_xml(self, xml_text: str, pmids: List[str]) -> List[PubMedArticle]:
        """解析PubMed XML响应"""
        import xml.etree.ElementTree as ET

        articles = []

        try:
            root = ET.fromstring(xml_text)

            for article in root.findall(".//PubmedArticle"):
                pmid_elem = article.find(".//PMID")
                if pmid_elem is None:
                    continue

                pmid = pmid_elem.text

                # 提取标题
                title_elem = article.find(".//ArticleTitle")
                title = title_elem.text if title_elem is not None else ""

                # 提取摘要
                abstract_elems = article.findall(".//AbstractText")
                abstract_parts = []
                for elem in abstract_elems:
                    if elem.text:
                        abstract_parts.append(elem.text)
                abstract = " ".join(abstract_parts) if abstract_parts else None

                # 提取作者
                author_elems = article.findall(".//AuthorList/Author")
                authors = []
                for author in author_elems:
                    last_name = author.find("LastName")
                    fore_name = author.find("ForeName")
                    if last_name is not None:
                        name = f"{last_name.text}"
                        if fore_name is not None:
                            name += f" {fore_name.text}"
                        authors.append(name)

                # 提取发表日期
                pub_date_elem = article.find(".//PubDate")
                pub_date = None
                if pub_date_elem is not None:
                    year = pub_date_elem.find("Year")
                    month = pub_date_elem.find("Month")
                    if year is not None:
                        pub_date = year.text
                        if month is not None:
                            pub_date += f"-{month.text.zfill(2)}"

                # 提取期刊
                journal_elem = article.find(".//Journal/Title")
                journal = journal_elem.text if journal_elem is not None else None

                # 提取PMC ID
                pmc_elem = article.find(".//ArticleId[@IdType='pmc']")
                pmc_id = pmc_elem.text if pmc_elem is not None else None

                # 提取DOI
                doi_elem = article.find(".//ArticleId[@IdType='doi']")
                doi = doi_elem.text if doi_elem is not None else None

                article = PubMedArticle(
                    pmid=pmid,
                    title=title,
                    abstract=abstract,
                    authors=authors,
                    publication_date=pub_date,
                    journal=journal,
                    pmc_id=pmc_id,
                    doi=doi,
                    keywords=[],
                    match_type="",
                    relevance_score=0.0
                )
                articles.append(article)

        except ET.ParseError as e:
            logger.error(f"XML parsing error: {e}")

        return articles

    async def _rate_limit(self):
        """速率限制"""
        import time

        if self.api_key:
            # 有API key: 10请求/秒
            min_interval = 0.1
        else:
            # 无API key: 3请求/分钟 = 0.5秒间隔
            min_interval = 20 / 3

        elapsed = time.time() - self.last_request_time
        if elapsed < min_interval:
            await asyncio.sleep(min_interval - elapsed)

        self.last_request_time = time.time()

    async def get_fulltext(self, pmc_id: str) -> Optional[str]:
        """获取PubMed Central全文"""
        import aiohttp

        url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmc_id}/xml/"

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        text = await response.text()
                        # 提取全文文本
                        return self._extract_fulltext(text)
                    else:
                        logger.warning(f"Fulltext fetch failed: {response.status}")
                        return None

        except Exception as e:
            logger.error(f"Fulltext error: {e}")
            return None

    def _extract_fulltext(self, xml_text: str) -> str:
        """从XML提取全文"""
        import xml.etree.ElementTree as ET

        try:
            root = ET.fromstring(xml_text)
            text_parts = []

            # 提取所有段落
            for p in root.iter("p"):
                if p.text:
                    text_parts.append(p.text)

            return "\n\n".join(text_parts)

        except ET.ParseError:
            return ""
