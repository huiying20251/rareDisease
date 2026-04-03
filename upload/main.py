"""
变异解读主入口模块
整合所有模块，提供统一的变异解读接口
"""

import asyncio
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from datetime import datetime

from .normalizer import VariantNormalizer, VariantInfo
from .database.clinvar import ClinVarQuery, ClinVarRecord
from .database.hgmd import HGMQuery, HGMRecord
from .literature.pubmed import PubMedSearch, PubMedArticle
from .literature.pubtator3 import PubTator3Search

logger = logging.getLogger(__name__)


@dataclass
class InterpretationResult:
    """变异解读结果"""
    # 变异信息
    variant_info: Dict[str, Any]

    # 数据库结果
    databases: Dict[str, Any]

    # 文献结果
    literature: Dict[str, Any]

    # 汇总信息
    summary: Dict[str, Any]

    # 元数据
    query_time: str
    query_type: str
    input_string: str


class VariantInterpreter:
    """变异解读器主类"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

        # 初始化各模块
        self.normalizer = VariantNormalizer(self.config)
        self.clinvar = ClinVarQuery(self.config)
        self.hgmd = HGMQuery(self.config)
        self.pubmed = PubMedSearch(self.config)
        self.pubtator3 = PubTator3Search(self.config)

    async def interpret(self, query_type: str, input_string: str,
                       gene_symbol: Optional[str] = None,
                       genome_build: Optional[str] = None) -> InterpretationResult:
        """
        执行变异解读

        Args:
            query_type: 查询类型 (rsid, hgvs_c, hgvs_p, vcf, position)
            input_string: 输入字符串
            gene_symbol: 基因符号（可选）
            genome_build: 基因组版本

        Returns:
            InterpretationResult: 解读结果
        """
        logger.info(f"Starting interpretation: {query_type} - {input_string}")

        start_time = datetime.now()

        # 步骤1: 变异标准化
        try:
            variant = self.normalizer.normalize(
                query_type, input_string, gene_symbol, genome_build
            )
            logger.info(f"Normalized variant: {variant.vcf_format}")
        except Exception as e:
            logger.error(f"Variant normalization failed: {e}")
            raise

        # 步骤2: 并行查询数据库和文献
        db_results, literature_results = await self._parallel_query(variant)

        # 步骤3: 汇总结果
        summary = self._create_summary(variant, db_results, literature_results)

        # 构建最终结果
        result = InterpretationResult(
            variant_info=variant.to_dict(),
            databases=db_results,
            literature=literature_results,
            summary=summary,
            query_time=start_time.isoformat(),
            query_type=query_type,
            input_string=input_string
        )

        logger.info(f"Interpretation completed in {(datetime.now() - start_time).total_seconds()}s")

        return result

    async def _parallel_query(self, variant: VariantInfo) -> tuple:
        """并行查询数据库和文献"""
        # 构建检索词
        search_queries = self.normalizer.build_search_queries(variant)

        # 创建查询任务
        tasks = []

        # 数据库查询
        if self.clinvar.db_config.get("enabled", True):
            tasks.append(self._query_clinvar(variant))

        if self.hgmd.db_config.get("enabled", True):
            tasks.append(self._query_hgmd(variant))

        # 文献查询 - PubMed
        tasks.append(self._search_pubmed(search_queries))

        # 文献查询 - PubTator3
        tasks.append(self._search_pubtator3(search_queries, variant.gene))

        # 并行执行
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 解析结果
        db_results = {}
        literature_results = {}

        # 处理数据库结果
        if len(results) >= 2:
            db_results["clinvar"] = results[0] if not isinstance(results[0], Exception) else None
            db_results["hgmd"] = results[1] if not isinstance(results[1], Exception) else None

        # 处理文献结果
        if len(results) >= 4:
            literature_results["pubmed"] = results[2] if not isinstance(results[2], Exception) else []
            literature_results["pubtator3"] = results[3] if not isinstance(results[3], Exception) else {}

        return db_results, literature_results

    async def _query_clinvar(self, variant: VariantInfo) -> Optional[Dict[str, Any]]:
        """查询ClinVar"""
        try:
            if variant.rs_id:
                record = await self.clinvar.query_by_rsid(variant.rs_id)
            else:
                record = await self.clinvar.query_by_position(
                    variant.chromosome,
                    variant.position,
                    variant.reference,
                    variant.alternate,
                    variant.genome_build
                )

            if record:
                return {
                    "variation_id": record.variation_id,
                    "classification": record.clinical_significance,
                    "review_status": record.review_status,
                    "last_evaluated": record.last_evaluated,
                    "diseases": record.diseases,
                    "rs_id": record.rs_id
                }
        except Exception as e:
            logger.error(f"ClinVar query error: {e}")

        return None

    async def _query_hgmd(self, variant: VariantInfo) -> Optional[Dict[str, Any]]:
        """查询HGMD"""
        try:
            record = await self.hgmd.query_by_position(
                variant.chromosome,
                variant.position,
                variant.reference,
                variant.alternate,
                variant.genome_build
            )

            if record:
                return {
                    "accession": record.accession,
                    "class": record.class_type,
                    "description": record.description,
                    "gene": record.gene,
                    "disease": record.disease,
                    "pubmed_id": record.pubmed_id,
                    "mutation_type": record.mutation_type
                }
        except Exception as e:
            logger.error(f"HGMD query error: {e}")

        return None

    async def _search_pubmed(self, queries: List[str]) -> List[Dict[str, Any]]:
        """搜索PubMed"""
        try:
            articles = await self.pubmed.search(queries, search_type="full")

            return [
                {
                    "pmid": a.pmid,
                    "title": a.title,
                    "abstract": a.abstract,
                    "publication_date": a.publication_date,
                    "journal": a.journal,
                    "pmc_id": a.pmc_id,
                    "doi": a.doi,
                    "source": "PubMed"
                }
                for a in articles[:50]  # 限制返回数量
            ]
        except Exception as e:
            logger.error(f"PubMed search error: {e}")
            return []

    async def _search_pubtator3(self, queries: List[str],
                                gene: Optional[str] = None) -> Dict[str, Any]:
        """搜索PubTator3"""
        try:
            articles = await self.pubtator3.search_and_annotate(queries)

            return {
                pmid: {
                    "genes": a.gene_entities,
                    "diseases": a.disease_entities,
                    "mutations": a.mutation_entities
                }
                for pmid, a in articles.items()
            }
        except Exception as e:
            logger.error(f"PubTator3 search error: {e}")
            return {}

    def _create_summary(self, variant: VariantInfo,
                       db_results: Dict,
                       literature_results: Dict) -> Dict[str, Any]:
        """创建汇总信息"""
        summary = {
            "variant": variant.vcf_format,
            "gene": variant.gene,
            "total_publications": 0,
            "clinical_classifications": [],
            "key_findings": []
        }

        # 统计文献数量
        pubmed_count = len(literature_results.get("pubmed", []))
        pubtator3_count = len(literature_results.get("pubtator3", {}))
        summary["total_publications"] = pubmed_count + pubtator3_count

        # ClinVar分类
        if db_results.get("clinvar"):
            clinvar = db_results["clinvar"]
            classification = clinvar.get("classification", "Unknown")
            summary["clinical_classifications"].append({
                "source": "ClinVar",
                "classification": classification,
                "review_status": clinvar.get("review_status")
            })
            summary["key_findings"].append(
                f"ClinVar: {classification} ({clinvar.get('review_status', 'N/A')})"
            )

        # HGMD分类
        if db_results.get("hgmd"):
            hgmd = db_results["hgmd"]
            class_type = hgmd.get("class", "Unknown")
            summary["clinical_classifications"].append({
                "source": "HGMD",
                "classification": class_type
            })
            summary["key_findings"].append(
                f"HGMD: {class_type} ({hgmd.get('description', '')})"
            )

        # 文献发现
        if summary["total_publications"] > 0:
            summary["key_findings"].append(
                f"找到 {summary['total_publications']} 篇相关文献"
            )

        return summary

    async def close(self):
        """关闭所有连接"""
        await self.clinvar.close()
        await self.hgmd.close()


async def main():
    """测试入口"""
    # 配置
    config = {
        "database": {
            "clinvar": {"enabled": False},
            "hgmd": {"enabled": False}
        },
        "pubmed": {
            "email": "test@example.com",
            "rate_limit": 3
        },
        "pubtator3": {
            "enabled": True
        }
    }

    interpreter = VariantInterpreter(config)

    # 测试查询
    result = await interpreter.interpret(
        query_type="hgvs_c",
        input_string="BRCA1:c.68_69delAG",
        gene_symbol="BRCA1"
    )

    print("Result:", result)
    await interpreter.close()


if __name__ == "__main__":
    asyncio.run(main())
