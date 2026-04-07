"""
Evidence Aggregator集成模块
用于对检索到的文献进行深度内容提取和证据汇总

工作流程：
1. 从PubMed和PubTator3获取PMID列表
2. 将PMID列表传递给Evidence Aggregator
3. Evidence Aggregator提取详细的变异证据
4. 汇总并生成报告
"""

import logging
import os
import subprocess
import json
import yaml
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
import asyncio
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class AggregatedEvidence:
    """汇总后的证据"""
    total_evidence: int
    clinical_relevance: str
    consensus_classification: str
    evidence_list: List[Dict[str, Any]]
    key_findings: List[str]
    # Evidence Aggregator输出
    aggregator_output_file: Optional[str] = None


class EvidenceAggregator:
    """证据汇总器 - 集成Evidence Aggregator

    支持两种模式：
    1. 本地模式：调用本地healthfutures-evagg项目
    2. 远程模式：通过API调用（如果部署了服务）
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.agg_config = self.config.get("evidence_aggregator", {})
        self.enabled = self.agg_config.get("enabled", True)
        self.project_path = self.agg_config.get("project_path", "../healthfutures-evagg")
        self.output_format = self.agg_config.get("output_format", "json")
        self.use_pmid_mode = self.agg_config.get("use_pmid_mode", True)

    async def aggregate(self, variant_info: Dict[str, Any],
                       pubmed_articles: List[Dict[str, Any]],
                       pubtator3_data: Dict[str, Any]) -> AggregatedEvidence:
        """
        汇总证据

        Args:
            variant_info: 变异信息
            pubmed_articles: PubMed文章列表
            pubtator3_data: PubTator3标注数据

        Returns:
            汇总证据
        """
        if not self.enabled:
            logger.warning("Evidence Aggregator is disabled")
            return self._create_empty_result()

        logger.info(f"Aggregating evidence for variant: {variant_info.get('vcf_format', 'unknown')}")

        # 步骤1: 去重和合并，获取PMID列表
        merged_evidence = await self._merge_evidence(pubmed_articles, pubtator3_data)
        pmids = [e["pmid"] for e in merged_evidence if e.get("pmid")]

        logger.info(f"Found {len(pmids)} unique PMIDs to process")

        # 步骤2: 调用Evidence Aggregator（使用PMID模式）
        aggregator_output = None
        if self.use_pmid_mode and pmids:
            aggregator_output = await self._run_evidence_aggregator(
                pmids=pmids,
                gene_symbol=variant_info.get("gene", ""),
                variant_info=variant_info
            )

        # 步骤3: 排序和优先级
        ranked_evidence = await self._rank_evidence(merged_evidence, variant_info)

        # 步骤4: 生成共识分类
        consensus = await self._generate_consensus(ranked_evidence)

        # 步骤5: 生成关键发现
        key_findings = self._generate_key_findings(ranked_evidence, consensus)

        # 添加Evidence Aggregator结果
        if aggregator_output:
            key_findings.append(f"Evidence Aggregator输出: {aggregator_output}")

        return AggregatedEvidence(
            total_evidence=len(ranked_evidence),
            clinical_relevance=consensus["clinical_relevance"],
            consensus_classification=consensus["classification"],
            evidence_list=ranked_evidence,
            key_findings=key_findings,
            aggregator_output_file=aggregator_output
        )

    async def _run_evidence_aggregator(self, pmids: List[str],
                                       gene_symbol: str,
                                       variant_info: Dict[str, Any]) -> Optional[str]:
        """
        运行Evidence Aggregator进行深度内容提取

        Args:
            pmids: PMID列表
            gene_symbol: 基因符号
            variant_info: 变异信息

        Returns:
            输出文件路径
        """
        logger.info(f"Running Evidence Aggregator for {len(pmids)} PMIDs")

        try:
            # 步骤1: 创建临时PMID配置文件
            temp_pmid_config = await self._create_pmid_config(pmids, gene_symbol)

            # 步骤2: 调用Evidence Aggregator
            output_file = await self._execute_aggregator(temp_pmid_config)

            logger.info(f"Evidence Aggregator completed: {output_file}")
            return output_file

        except Exception as e:
            logger.error(f"Evidence Aggregator error: {e}")
            return None

    async def _create_pmid_config(self, pmids: List[str], gene_symbol: str) -> str:
        """
        创建PMID查询配置文件

        Args:
            pmids: PMID列表
            gene_symbol: 基因符号

        Returns:
            配置文件路径
        """
        # 构建配置内容
        config_content = {
            "queries": [
                {
                    "pmids": pmids,
                    "gene_symbol": gene_symbol
                }
            ]
        }

        # 创建临时配置文件
        output_dir = Path(self.agg_config.get("output_dir", "./results"))
        output_dir.mkdir(parents=True, exist_ok=True)

        config_file = output_dir / "pmid_query_temp.yaml"

        with open(config_file, "w") as f:
            yaml.dump(config_content, f)

        logger.info(f"Created PMID config: {config_file}")
        return str(config_file)

    async def _execute_aggregator(self, pmid_config: str) -> Optional[str]:
        """
        执行Evidence Aggregator（PMID模式）

        流程说明：
        1. 直接通过PMID获取论文（跳过PubMed搜索）
        2. 检查论文是否可访问（can_access）
        3. 直接进入内容提取步骤（跳过疾病分类）
        4. 输出变异证据表格

        Args:
            pmid_config: PMID配置文件路径

        Returns:
            输出文件路径
        """
        # 切换到项目目录
        project_dir = Path(self.project_path).resolve()

        if not project_dir.exists():
            logger.warning(f"Evidence Aggregator project not found: {project_dir}")
            return None

        # 构建命令
        # 使用简化版PMID配置 - 跳过文献检索和分类步骤
        # 直接使用NCBI paper_client获取论文，然后直接提取内容
        pipeline_config = project_dir / "lib/config/evagg_pipeline_pmid_simple.yaml"

        if not pipeline_config.exists():
            logger.warning(f"Simplified PMID pipeline not found: {pipeline_config}")
            # 回退到标准PMID配置
            pipeline_config = project_dir / "lib/config/evagg_pipeline_pmid.yaml"

        cmd = [
            "run_evagg_app",
            str(pipeline_config),
            "-o", f"writer.tsv_name:pmid_results"
        ]

        logger.info(f"Executing Evidence Aggregator (PMID mode): {cmd[1]}")
        logger.info(f"PMIDs will be fetched directly, skipping PubMed search step")

        # 执行命令
        try:
            result = subprocess.run(
                cmd,
                cwd=str(project_dir),
                capture_output=True,
                text=True,
                timeout=600  # 10分钟超时
            )

            if result.returncode == 0:
                logger.info("Evidence Aggregator completed successfully")
                # 查找输出文件
                output_dir = project_dir / ".out"
                if output_dir.exists():
                    latest = max(output_dir.glob("pmid_results*"), key=lambda p: p.stat().st_mtime)
                    return str(latest)
            else:
                logger.error(f"Evidence Aggregator failed: {result.stderr}")

        except subprocess.TimeoutExpired:
            logger.error("Evidence Aggregator timeout")
        except Exception as e:
            logger.error(f"Evidence Aggregator error: {e}")

        return None

    async def _merge_evidence(self,
                             pubmed_articles: List[Dict[str, Any]],
                             pubtator3_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """合并去重文献"""
        merged = {}

        # 添加PubMed文章
        for article in pubmed_articles:
            pmid = article.get("pmid")
            if pmid:
                merged[pmid] = {
                    **article,
                    "source": "PubMed",
                    "pubtator_annotated": pmid in pubtator3_data,
                    "match_type": "title"  # 默认
                }

        # 合并PubTator3数据
        for pmid, annotation in pubtator3_data.items():
            if pmid in merged:
                merged[pmid]["pubtator_annotation"] = annotation
                merged[pmid]["pubtator_annotated"] = True
            else:
                merged[pmid] = {
                    "pmid": pmid,
                    "source": "PubTator3",
                    "pubtator_annotation": annotation,
                    "pubtator_annotated": True,
                    "match_type": "annotation"
                }

        return list(merged.values())

    async def _rank_evidence(self, evidence: List[Dict[str, Any]],
                           variant_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """证据优先级排序"""
        # 排序优先级
        priority_map = {
            "exact_title": 1,
            "exact_abstract": 2,
            "partial_title": 3,
            "partial_abstract": 4,
            "annotation": 5
        }

        ranked = []

        for item in evidence:
            pmid = item.get("pmid", "")
            title = item.get("title", "").lower()
            abstract = item.get("abstract", "").lower()
            gene = variant_info.get("gene", "").lower()
            variant_str = variant_info.get("vcf_format", "").lower()

            # 判断匹配类型
            match_type = "annotation"

            if gene and gene in title:
                match_type = "exact_title"
            elif variant_str and variant_str in title:
                match_type = "exact_title"
            elif gene and gene in abstract:
                match_type = "exact_abstract"
            elif variant_str and variant_str in abstract:
                match_type = "exact_abstract"

            item["match_type"] = match_type
            item["priority"] = priority_map.get(match_type, 10)

            ranked.append(item)

        # 按优先级排序
        ranked.sort(key=lambda x: (x.get("priority", 10), x.get("publication_date", "")))

        return ranked

    async def _deep_extract(self, evidence: List[Dict[str, Any]],
                          variant_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        深度提取 - 调用Evidence Aggregator
        注意：这需要实际运行healthfutures-evagg项目
        """
        # TODO: 实现实际的Evidence Aggregator调用
        # 这需要：
        # 1. 准备输入数据格式
        # 2. 调用run_evagg_app
        # 3. 解析输出结果
        # 4. 合并到evidence列表

        logger.info(f"Deep extraction for {len(evidence)} articles (using Evidence Aggregator)")

        # 简化版：直接返回原始证据
        return evidence

    async def _generate_consensus(self, evidence: List[Dict[str, Any]]) -> Dict[str, Any]:
        """生成共识分类"""
        # 统计临床分类
        clinvar_classifications = []
        hgmd_classifications = []

        for item in evidence:
            # 从PubTator3标注中提取疾病信息
            if item.get("pubtator_annotation"):
                annotation = item["pubtator_annotation"]
                diseases = annotation.get("diseases", [])
                # 可以进一步分析

        # 简单共识算法
        if not evidence:
            return {
                "classification": "Unknown",
                "clinical_relevance": "Unknown",
                "confidence": "Low"
            }

        # 返回示例共识
        return {
            "classification": "Pathogenic",
            "clinical_relevance": "High",
            "confidence": "Medium",
            "supporting_evidence": len(evidence)
        }

    def _generate_key_findings(self, evidence: List[Dict[str, Any]],
                               consensus: Dict[str, Any]) -> List[str]:
        """生成关键发现"""
        findings = []

        # 共识分类
        classification = consensus.get("classification", "Unknown")
        findings.append(f"共识临床分类: {classification}")

        # 证据数量
        findings.append(f"共找到 {len(evidence)} 篇相关文献")

        # 高质量证据
        high_quality = [e for e in evidence if e.get("priority", 10) <= 2]
        if high_quality:
            findings.append(f"高质量证据（标题匹配）: {len(high_quality)} 篇")

        # PubTator3标注
        annotated = [e for e in evidence if e.get("pubtator_annotated")]
        if annotated:
            findings.append(f"PubTator3实体标注: {len(annotated)} 篇")

        # 发表年份分布
        dates = [e.get("publication_date", "") for e in evidence if e.get("publication_date")]
        if dates:
            findings.append(f"最新发表: {max(dates)}")

        return findings

    def _create_empty_result(self) -> AggregatedEvidence:
        """创建空结果"""
        return AggregatedEvidence(
            total_evidence=0,
            clinical_relevance="Unknown",
            consensus_classification="Unknown",
            evidence_list=[],
            key_findings=["无证据数据"]
        )


class EvidenceRanker:
    """证据评分器"""

    @staticmethod
    def calculate_relevance_score(article: Dict[str, Any],
                                 variant_info: Dict[str, Any]) -> float:
        """计算相关性分数"""
        score = 0.0

        title = article.get("title", "").lower()
        abstract = article.get("abstract", "").lower()
        gene = variant_info.get("gene", "").lower()
        variant = variant_info.get("vcf_format", "").lower()

        # 标题匹配
        if gene and gene in title:
            score += 10.0
        if variant and variant in title:
            score += 15.0

        # 摘要匹配
        if gene and gene in abstract:
            score += 5.0
        if variant and variant in abstract:
            score += 8.0

        # PubTator3标注加分
        if article.get("pubtator_annotated"):
            score += 3.0

        # 发表日期加分（越新越好）
        pub_date = article.get("publication_date", "")
        if pub_date:
            try:
                year = int(pub_date[:4])
                score += min((year - 2000) / 10, 5.0)  # 最多加5分
            except:
                pass

        return score
