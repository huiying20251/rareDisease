"""
PubTator3 API检索模块
"""

import logging
from typing import Optional, Dict, Any, List, Set
from dataclasses import dataclass
import asyncio

logger = logging.getLogger(__name__)


@dataclass
class PubTatorAnnotation:
    """PubTator3标注结果"""
    pmid: str
    title_annotations: List[Dict[str, Any]]  # 标题中的实体
    abstract_annotations: List[Dict[str, Any]]  # 摘要中的实体
    # 实体类型: gene, disease, chemical, mutation, species, cell_line, etc.


@dataclass
class PubTatorArticle:
    """PubTator3检索结果"""
    pmid: str
    gene_entities: List[str]
    disease_entities: List[str]
    chemical_entities: List[str]
    mutation_entities: List[str]
    all_entities: Dict[str, List[Dict[str, Any]]]


class PubTator3Search:
    """PubTator3文献检索"""

    BASE_URL = "https://www.ncbi.nlm.nih.gov/research/pubtator3/api"

    # 可用的实体类型
    ENTITY_TYPES = ["genes", "diseases", "chemicals", "mutations", "species", "celllines"]

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        pubtator3_config = self.config.get("pubtator3", {})

        self.enabled = pubtator3_config.get("enabled", True)
        self.base_url = pubtator3_config.get("base_url", self.BASE_URL)
        self.timeout = pubtator3_config.get("timeout", 30)
        self.entity_types = pubtator3_config.get("entity_types",
                                                    ["gene", "disease", "chemical", "mutation"])

    async def search_by_genes(self, genes: List[str], max_results: int = 100) -> List[str]:
        """
        按基因搜索相关PMID

        Args:
            genes: 基因列表
            max_results: 最大结果数

        Returns:
            PMID列表
        """
        if not self.enabled:
            return []

        pmids = set()

        for gene in genes:
            try:
                gene_pmids = await self._search_gene(gene, max_results)
                pmids.update(gene_pmids)
            except Exception as e:
                logger.error(f"Error searching gene {gene}: {e}")

        return list(pmids)[:max_results]

    async def search_by_mutations(self, mutations: List[str], max_results: int = 100) -> List[str]:
        """
        按变异搜索相关PMID

        Args:
            mutations: 变异列表 (如 c.7035del, rs12345)
            max_results: 最大结果数

        Returns:
            PMID列表
        """
        if not self.enabled:
            return []

        pmids = set()

        for mutation in mutations:
            try:
                mutation_pmids = await self._search_mutation(mutation, max_results)
                pmids.update(mutation_pmids)
            except Exception as e:
                logger.error(f"Error searching mutation {mutation}: {e}")

        return list(pmids)[:max_results]

    async def search_combined(self, genes: List[str], mutations: List[str],
                             max_results: int = 100) -> List[str]:
        """
        组合搜索（并行）

        Args:
            genes: 基因列表
            mutations: 变异列表
            max_results: 最大结果数

        Returns:
            PMID列表
        """
        if not self.enabled:
            return []

        tasks = []

        if genes:
            tasks.append(self.search_by_genes(genes, max_results))

        if mutations:
            tasks.append(self.search_by_mutations(mutations, max_results))

        if not tasks:
            return []

        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_pmids = set()
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Search error: {result}")
                continue
            all_pmids.update(result)

        return list(all_pmids)[:max_results]

    async def get_annotations(self, pmids: List[str]) -> Dict[str, PubTatorAnnotation]:
        """
        获取PMID列表的实体标注

        Args:
            pmids: PMID列表

        Returns:
            PMID到标注的映射
        """
        if not self.enabled or not pmids:
            return {}

        # PubTator3 API每次最多处理100个PMIDs
        results = {}
        batch_size = 100

        for i in range(0, len(pmids), batch_size):
            batch = pmids[i:i+batch_size]
            try:
                batch_annotations = await self._fetch_annotations(batch)
                results.update(batch_annotations)
            except Exception as e:
                logger.error(f"Error fetching annotations: {e}")

        return results

    async def _search_gene(self, gene: str, max_results: int) -> List[str]:
        """搜索基因相关的PMID"""
        import aiohttp

        url = f"{self.base_url}/search"

        # 使用gene name搜索
        params = {
            "terms": gene,
            "type": "gene",
            "format": "pmids",
            "num": max_results
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=self.timeout) as response:
                    if response.status == 200:
                        text = await response.text()
                        pmids = [p.strip() for p in text.split("\n") if p.strip()]
                        logger.info(f"Found {len(pmids)} PMIDs for gene {gene}")
                        return pmids
                    else:
                        logger.warning(f"Gene search failed: {response.status}")
                        return []

        except Exception as e:
            logger.error(f"Gene search error: {e}")
            return []

    async def _search_mutation(self, mutation: str, max_results: int) -> List[str]:
        """搜索变异相关的PMID"""
        import aiohttp

        url = f"{self.base_url}/search"

        # 使用mutation搜索
        params = {
            "terms": mutation,
            "type": "mutation",
            "format": "pmids",
            "num": max_results
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=self.timeout) as response:
                    if response.status == 200:
                        text = await response.text()
                        pmids = [p.strip() for p in text.split("\n") if p.strip()]
                        logger.info(f"Found {len(pmids)} PMIDs for mutation {mutation}")
                        return pmids
                    else:
                        logger.warning(f"Mutation search failed: {response.status}")
                        return []

        except Exception as e:
            logger.error(f"Mutation search error: {e}")
            return []

    async def _fetch_annotations(self, pmids: List[str]) -> Dict[str, PubTatorAnnotation]:
        """获取批量PMID的标注"""
        import aiohttp

        url = f"{self.base_url}/annotations"

        # 构建请求数据
        pmid_string = ",".join(pmids)

        results = {}

        for entity_type in self.entity_types:
            params = {
                "pmids": pmid_string,
                "types": entity_type,
                "format": "json"
            }

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, params=params, timeout=self.timeout) as response:
                        if response.status == 200:
                            data = await response.json()
                            # 解析响应
                            annotations = self._parse_annotations(data, entity_type)
                            results.update(annotations)

            except Exception as e:
                logger.error(f"Annotation fetch error for {entity_type}: {e}")

        return self._merge_annotations(results)

    def _parse_annotations(self, data: Dict, entity_type: str) -> Dict[str, PubTatorAnnotation]:
        """解析标注数据"""
        # TODO: 实现实际的解析逻辑
        return {}

    def _merge_annotations(self, annotation_dicts: List[Dict]) -> Dict[str, PubTatorAnnotation]:
        """合并多个标注结果"""
        # TODO: 实现合并逻辑
        return {}

    async def search_and_annotate(self, queries: List[str]) -> Dict[str, PubTatorArticle]:
        """
        搜索并获取完整标注

        使用OR组合策略，最大化召回率：
        - rsID作为变异实体搜索
        - HGVS格式（c.XXX或p.XXX）作为变异实体搜索
        - 基因名称作为基因实体搜索
        - 染色体位置作为变异实体搜索
        - 所有结果取并集

        Args:
            queries: 查询词列表

        Returns:
            PMID到文章信息的映射
        """
        if not self.enabled:
            return {}

        # 分离基因和变异查询
        genes = []
        mutations = []

        for query in queries:
            # rsID -> 变异实体
            if query.startswith("rs"):
                mutations.append(query)
            # 染色体位置 (chr17:12345678:G:A 或 17:12345678:G:A) -> 变异实体
            elif query.startswith("chr") or (query[0].isdigit() and ":" in query):
                mutations.append(query)
            # HGVS c.格式 (如 BRCA1:c.234C>G) -> 变异实体
            elif ":c." in query.lower():
                # 提取基因部分作为基因搜索
                gene_part = query.split(":")[0]
                if gene_part:
                    genes.append(gene_part)
                # 完整HGVS作为变异搜索
                mutations.append(query)
            # HGVS p.格式 (如 BRCA1:p.Ser78Trp) -> 变异实体
            elif ":p." in query.lower():
                gene_part = query.split(":")[0]
                if gene_part:
                    genes.append(gene_part)
                mutations.append(query)
            # 纯基因名称 -> 基因实体
            else:
                genes.append(query)

        # 搜索PMIDs（内部使用OR合并结果）
        pmids = await self.search_combined(genes, mutations, max_results=50)

        if not pmids:
            return {}

        # 获取标注
        annotations = await self.get_annotations(pmids)

        # 转换为简化格式
        result = {}
        for pmid, annotation in annotations.items():
            article = PubTatorArticle(
                pmid=pmid,
                gene_entities=self._extract_entities(annotation, "gene"),
                disease_entities=self._extract_entities(annotation, "disease"),
                chemical_entities=self._extract_entities(annotation, "chemical"),
                mutation_entities=self._extract_entities(annotation, "mutation"),
                all_entities={}
            )
            result[pmid] = article

        return result

    def _extract_entities(self, annotation: PubTatorAnnotation, entity_type: str) -> List[str]:
        """提取指定类型的实体"""
        # TODO: 实现提取逻辑
        return []
