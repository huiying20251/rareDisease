/**
 * 变异格式解析工具
 * 支持多种变异表示格式的解析和标准化
 *
 * 支持格式：
 * - VCF: chr17:43045678:G:A, 17:43045678:G:A, 17:43045678G>A
 * - rsID: rs80357713
 * - HGVS cDNA: c.5266dupC, BRCA1:c.5266dupC
 * - HGVS protein: p.(Gln1756ProfsTer74)
 * - gDNA: g.12345A>G
 */

export interface ParsedVariant {
  /** 解析出的变异格式 */
  format: 'vcf' | 'rsid' | 'hgvs' | 'unknown'
  /** 染色体 (仅 VCF 格式) */
  chrom?: string
  /** 基因组位置 (仅 VCF 格式) */
  pos?: number
  /** 参考碱基 (仅 VCF 格式) */
  ref?: string
  /** 替换碱基 (仅 VCF 格式) */
  alt?: string
  /** rsID (仅 rsID 格式) */
  rsid?: string
  /** HGVS 原始字符串 (仅 HGVS 格式) */
  hgvs?: string
  /** 基因符号 (如果能从 HGVS 前缀中提取) */
  geneSymbol?: string
}

/**
 * 解析变异表示法
 * @param notation 原始变异表示字符串 (来自 intent-classifier 的 extractedData.variantNotation)
 * @param userMessage 完整用户消息 (用于补充提取信息)
 */
export function parseVariantNotation(
  notation?: string,
  userMessage?: string,
): ParsedVariant {
  const input = notation?.trim() || ''
  if (!input) return { format: 'unknown' }

  // 1. 尝试 rsID 格式: rs80357713
  const rsidMatch = input.match(/^rs\d+$/i)
  if (rsidMatch) {
    return {
      format: 'rsid',
      rsid: rsidMatch[0].toLowerCase(),
    }
  }

  // 2. 尝试 VCF 格式 (冒号分隔): chr17:43045678:G:A 或 17:43045678:G:A
  const vcfColonMatch = input.match(
    /^(?:chr)?([XY\d]+|MT):(\d+):([ACGT]+):([ACGT]+)$/i,
  )
  if (vcfColonMatch) {
    return {
      format: 'vcf',
      chrom: normalizeChrom(vcfColonMatch[1]),
      pos: parseInt(vcfColonMatch[2]),
      ref: vcfColonMatch[3].toUpperCase(),
      alt: vcfColonMatch[4].toUpperCase(),
    }
  }

  // 3. 尝试 VCF 格式 (箭头分隔): 17:43045678G>A
  const vcfArrowMatch = input.match(
    /^(?:chr)?([XY\d]+|MT):(\d+)([ACGT]+)>([ACGT]+)$/i,
  )
  if (vcfArrowMatch) {
    return {
      format: 'vcf',
      chrom: normalizeChrom(vcfArrowMatch[1]),
      pos: parseInt(vcfArrowMatch[2]),
      ref: vcfArrowMatch[3].toUpperCase(),
      alt: vcfArrowMatch[4].toUpperCase(),
    }
  }

  // 4. 尝试从用户消息中提取 rsID (如果 notation 本身不是 rsID)
  if (userMessage) {
    const rsidInMessage = userMessage.match(/\b(rs\d+)\b/i)
    if (rsidInMessage) {
      return {
        format: 'rsid',
        rsid: rsidInMessage[1].toLowerCase(),
      }
    }
  }

  // 5. 尝试从用户消息中提取 VCF 格式 (notation 可能是 HGVS, 但消息中可能同时包含 VCF)
  if (userMessage) {
    const vcfInMessage = userMessage.match(
      /(?:chr)?([XY\d]+|MT)[:\s]+(\d+)\s*[:\s]*([ACGT]+)\s*[>:]\s*([ACGT]+)/i,
    )
    if (vcfInMessage) {
      return {
        format: 'vcf',
        chrom: normalizeChrom(vcfInMessage[1]),
        pos: parseInt(vcfInMessage[2]),
        ref: vcfInMessage[3].toUpperCase(),
        alt: vcfInMessage[4].toUpperCase(),
      }
    }
  }

  // 6. HGVS 格式: c.xxx, p.xxx, g.xxx (需要基因组位置，无法直接调用 VEP)
  const hgvsMatch = input.match(
    /^(?:([A-Z0-9]+):\s*)?(?:c\.|p\.|g\.|n\.)\S+/i,
  )
  if (hgvsMatch) {
    // 尝试提取基因符号
    const geneSymbol = hgvsMatch[1] || extractGeneFromMessage(userMessage)
    return {
      format: 'hgvs',
      hgvs: input,
      geneSymbol,
    }
  }

  // 7. 回退：如果 notation 看起来不像任何已知格式，检查消息中是否有可用信息
  if (userMessage) {
    const rsidFallback = userMessage.match(/\b(rs\d+)\b/i)
    if (rsidFallback) {
      return {
        format: 'rsid',
        rsid: rsidFallback[1].toLowerCase(),
      }
    }
  }

  return { format: 'unknown' }
}

/**
 * 标准化染色体名称
 */
function normalizeChrom(chrom: string): string {
  const upper = chrom.toUpperCase()
  if (upper === 'MT' || upper === 'M') return 'MT'
  // 去掉 "CHR" 前缀
  return upper.replace(/^CHR/, '')
}

/**
 * 从用户消息中提取基因符号
 */
function extractGeneFromMessage(message?: string): string | undefined {
  if (!message) return undefined

  // 常见基因符号列表
  const commonGenes = [
    'BRCA1', 'BRCA2', 'TP53', 'CFTR', 'DMD', 'NF1', 'RET',
    'FBN1', 'MYH7', 'SCN1A', 'SMN1', 'TSC1', 'TSC2', 'MLH1',
    'MSH2', 'MSH6', 'PMS2', 'APC', 'RB1', 'WT1', 'EGFR',
    'ALK', 'BRAF', 'KRAS', 'PIK3CA', 'CDH1', 'PALB2', 'ATM',
    'CHEK2', 'PTEN', 'STK11', 'GAA', 'GBA', 'HTT', 'F8', 'F9',
    'MECP2', 'SMAD4', 'BMPR1A', 'MUTYH', 'PTCH1', 'VHL',
  ]

  for (const gene of commonGenes) {
    if (message.match(new RegExp(`\\b${gene}\\b`, 'i'))) {
      return gene
    }
  }
  return undefined
}

/**
 * 构建 VCF 格式字符串 (用于日志和展示)
 */
export function formatVcfString(
  chrom: string,
  pos: number,
  ref: string,
  alt: string,
): string {
  return `${chrom}:${pos}:${ref}:${alt}`
}

/**
 * 判断是否可以进行 ACMG 全流程分析
 * (需要 VCF 或 rsID 格式才能获取基因组坐标)
 */
export function canRunAcmgPipeline(parsed: ParsedVariant): boolean {
  return parsed.format === 'vcf' || parsed.format === 'rsid'
}
