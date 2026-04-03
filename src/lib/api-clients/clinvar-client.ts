/**
 * ClinVar API 客户端
 * NCBI ClinVar: https://www.ncbi.nlm.nih.gov/clinvar/
 * E-utilities: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
 * 
 * 查询 ClinVar 变异临床意义
 */

import type { ClinVarData } from '@/lib/acmg/types'

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const CLINVAR_BASE = 'https://api.ncbi.nlm.nih.gov/clinvar/variation'

interface ClinVarVariantResponse {
  clinicalSignificance?: {
    description?: string
    reviewStatus?: string
    lastEvaluated?: string
  }
  variationId?: string
  referenceClinVarAssertion?: Array<{
    clinicalSignificance?: string
    reviewStatus?: string
    traitSet?: Array<{
      trait?: Array<{
        name?: string
      }>
    }>
  }>
 submittedAllele?: Array<{
    clinVarAccession?: string
  }>
}

/**
 * 通过 VCF 位置查询 ClinVar
 * 使用 /variation/search VCF 端点
 */
export async function queryClinVarByPosition(
  chrom: string,
  pos: number,
  ref: string,
  alt: string,
): Promise<ClinVarData | null> {
  // 使用 NCBI ClinVar Variation Search API
  const vcfStr = `${chrom}-${pos}-${ref}-${alt}`.toUpperCase()
  
  // 先尝试 VCF search
  try {
    const url = `${CLINVAR_BASE}/search/vcf?variation=${encodeURIComponent(vcfStr)}`
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (response.ok) {
      const text = await response.text()
      // Variation search returns variation IDs
      if (text && text.startsWith('VCV')) {
        const variationId = text.trim()
        return queryClinVarById(variationId)
      }
    }
  } catch {
    // Continue to fallback
  }

  // Fallback: 使用 efetch 通过位置查询
  return queryClinVarByPositionEutils(chrom, pos, ref, alt)
}

/**
 * 通过 rsID 查询 ClinVar
 */
export async function queryClinVarByRsid(rsid: string): Promise<ClinVarData | null> {
  try {
    const url = `${CLINVAR_BASE}/search/rs?rs_id=${encodeURIComponent(rsid)}`
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return null

    const text = await response.text()
    if (text && text.startsWith('VCV')) {
      const variationId = text.trim()
      return queryClinVarById(variationId)
    }
    return null
  } catch {
    return null
  }
}

/**
 * 通过 Variation ID 查询详细信息
 */
export async function queryClinVarById(variationId: string): Promise<ClinVarData | null> {
  try {
    const url = `${CLINVAR_BASE}/${variationId}/summary`
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return null

    const data = await response.json() as ClinVarVariantResponse

    const clinicalSig = data.clinicalSignificance || data.referenceClinVarAssertion?.[0]?.clinicalSignificance
    const reviewStatus = data.clinicalSignificance?.reviewStatus || data.referenceClinVarAssertion?.[0]?.reviewStatus
    const lastEval = data.clinicalSignificance?.lastEvaluated

    // 提取疾病
    const diseases: string[] = []
    for (const rca of data.referenceClinVarAssertion || []) {
      for (const ts of rca.traitSet || []) {
        for (const trait of ts.trait || []) {
          if (trait.name && !diseases.includes(trait.name)) {
            diseases.push(trait.name)
          }
        }
      }
    }

    return {
      variationId: data.variationId || variationId,
      clinicalSignificance: clinicalSig,
      reviewStatus,
      lastEvaluated: lastEval,
      diseases,
    }
  } catch {
    return null
  }
}

/**
 * Fallback: 通过 E-utilities esearch + efetch 查询
 */
async function queryClinVarByPositionEutils(
  chrom: string,
  pos: number,
  ref: string,
  alt: string,
): Promise<ClinVarData | null> {
  try {
    // Search ClinVar by genomic position
    const searchTerm = `${chrom}[CHR] AND ${pos}[POSITION] AND ("${ref}/${alt}"[ALLELE] OR "${ref}>${alt}"[ALLELE])`
    const searchUrl = `${EUTILS_BASE}/esearch.fcgi?db=clinvar&term=${encodeURIComponent(searchTerm)}&retmax=5&retmode=json`

    const searchResponse = await fetch(searchUrl, {
      signal: AbortSignal.timeout(15000),
    })

    if (!searchResponse.ok) return null

    const searchData = await searchResponse.json()
    const ids = searchData?.esearchresult?.idlist

    if (!ids || ids.length === 0) return null

    // Fetch first result
    const fetchUrl = `${EUTILS_BASE}/efetch.fcgi?db=clinvar&id=${ids[0]}&rettype=variation&retmode=json`
    const fetchResponse = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(15000),
    })

    if (!fetchResponse.ok) return null

    const fetchData = await fetchResponse.json()

    // Parse ClinVar XML/JSON format
    const clinicalData = fetchData?.clinvar_set?.reference_clinvar_assertion?.clinical_significance
    if (!clinicalData) return null

    const description = typeof clinicalData === 'string'
      ? clinicalData
      : clinicalData?.description

    const review = clinicalData?.review_status

    return {
      variationId: ids[0],
      clinicalSignificance: description,
      reviewStatus: review,
    }
  } catch {
    return null
  }
}

/**
 * gnomAD API 客户端 (仅用于补充 VEP 未覆盖的数据)
 * gnomAD Browser API: https://gnomad.broadinstitute.org/api
 */
export async function queryGnomadByPosition(
  chrom: string,
  pos: number,
  ref: string,
  alt: string,
): Promise<{
  afGlobal?: number
  afAfr?: number
  afAmr?: number
  afEas?: number
  afNfe?: number
  afSas?: number
  popmaxFreq?: number
  popmaxPop?: string
  homCount?: number
  hemiCount?: number
} | null> {
  try {
    const gnomadChrom = chrom === 'MT' ? 'MT' : chrom
    const url = `https://gnomad.broadinstitute.org/api/variant/${gnomadChrom}-${pos}-${ref}-${alt}?dataset=gnomad_r4`

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(20000),
    })

    if (!response.ok) return null

    const data = await response.json() as any

    if (!data || !data.gene_symbol) return null

    const genome = data.genomes || {}
    const exomes = data.exomes || {}

    // 优先使用 genomes 数据
    const popData = genome.allele_counts?.[0] || exomes.allele_counts?.[0] || {}
    const popFreqs = genome.allele_frequencies?.[0] || exomes.allele_frequencies?.[0] || {}

    const afGlobal = genome.allele_frequency || exomes.allele_frequency

    // Find popmax
    let popmaxFreq = 0
    let popmaxPop = ''
    const popMap: Record<string, string> = {
      'afr': 'AFR',
      'amr': 'AMR',
      'eas': 'EAS',
      'nfe': 'NFE',
      'sas': 'SAS',
      'fin': 'FIN',
      'asj': 'ASJ',
      'mid': 'MID',
      'ami': 'AMI',
    }

    for (const [key, label] of Object.entries(popMap)) {
      const freq = popFreqs[key] || genome[`af_${key}`] || exomes[`af_${key}`]
      if (typeof freq === 'number' && freq > popmaxFreq) {
        popmaxFreq = freq
        popmaxPop = label
      }
    }

    const homCount = popData.homozygote_count
    const hemiCount = popData.hemizygote_count

    return {
      afGlobal,
      afAfr: popFreqs.afr,
      afAmr: popFreqs.amr,
      afEas: popFreqs.eas,
      afNfe: popFreqs.nfe,
      afSas: popFreqs.sas,
      popmaxFreq: popmaxFreq > 0 ? popmaxFreq : undefined,
      popmaxPop: popmaxPop || undefined,
      homCount,
      hemiCount,
    }
  } catch {
    return null
  }
}
