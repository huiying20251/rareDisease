/**
 * Ensembl VEP (Variant Effect Predictor) API 客户端
 * https://rest.ensembl.org/documentation/info/vep_region
 * 
 * 用于获取变异注释：基因、转录本、HGVS命名、功能预测分数、gnomAD频率
 */

import type { VariantAnnotation, VepConsequence, GnomadData } from '@/lib/acmg/types'

const VEP_BASE = 'https://rest.ensembl.org'

interface VepResponse {
  id?: string
  seq_region_name?: string
  start?: number
  most_severe_consequence?: string
  input?: string
  collocated_variants?: Array<{
    id?: string
    clin_sig?: string[]
    clin_sig_allele?: string
    review_status?: string
    phenotypes?: string[]
    frequencies?: Record<string, number>
    max_af?: number
  }>
  transcript_consequences?: Array<{
    gene_symbol?: string
    transcript_id?: string
    refseq_transcript_id?: string
    hgvsc?: string
    hgvsp?: string
    consequence_terms?: string[]
    impact?: string
    mane_select?: boolean | string
    canonical?: boolean
    sift_score?: number
    polyphen_score?: number
    cadd_phred?: number
    cadd_raw?: number
    revel_score?: number
    splice_ai_ds_max?: number
    splice_ai_ag_max?: number
    lof?: string
    lof_filter?: string
    lof_flags?: string
    exon?: string
    intron?: string
    protein_start?: number
    protein_end?: number
    uniprot?: string
  }>
  max_af?: number
  ancestral?: string
}

export async function annotateWithVep(
  chrom: string,
  pos: number,
  ref: string,
  alt: string,
): Promise<{ annotation: VariantAnnotation; vep: VepConsequence; gnomad: GnomadData } | null> {
  const region = `${chrom}:${pos}:${pos}:1/${alt}`
  const url = `${VEP_BASE}/vep/human/region/${region}`

  const params = new URLSearchParams({
    mane: '1',
    gencode_primary: '1',
    refseq: '1',
    canonical: '1',
    hgvs: '1',
    protein: '1',
    uniprot: '1',
    pick: '1',
    pick_allele: '1',
    af_gnomadg: '1',
    af_gnomade: '1',
    max_af: '1',
    sift: 'b',
    polyphen: 'b',
    cadd: 'b',
    revel: 'b',
    spliceai: 'b',
    loftee: 'b',
    domains: '1',
    symbol: '1',
  })

  try {
    const response = await fetch(`${url}?${params}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`VEP API error: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()

    if (!Array.isArray(data) || data.length === 0) {
      return null
    }

    const vepData: VepResponse = data[0]
    return parseVepResponse(vepData, chrom, pos, ref, alt)
  } catch (error) {
    console.error('VEP annotation failed:', error)
    return null
  }
}

export async function annotateWithVepByRsid(
  rsid: string,
): Promise<{ annotation: VariantAnnotation; vep: VepConsequence; gnomad: GnomadData } | null> {
  const url = `${VEP_BASE}/vep/human/id/${rsid}`

  const params = new URLSearchParams({
    mane: '1',
    gencode_primary: '1',
    refseq: '1',
    canonical: '1',
    hgvs: '1',
    protein: '1',
    uniprot: '1',
    pick: '1',
    af_gnomadg: '1',
    af_gnomade: '1',
    max_af: '1',
    sift: 'b',
    polyphen: 'b',
    cadd: 'b',
    revel: 'b',
    spliceai: 'b',
    loftee: 'b',
    symbol: '1',
  })

  try {
    const response = await fetch(`${url}?${params}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) return null

    const data = await response.json()
    if (!Array.isArray(data) || data.length === 0) return null

    const vepData: VepResponse = data[0]

    // 从 VEP 响应解析位置信息
    const inputStr = vepData.input || ''
    const inputMatch = inputStr.match(/(\d+|X|Y|MT):(\d+):([ACGT]+):([ACGT]+)/i)
    if (!inputMatch) return null

    return parseVepResponse(
      vepData,
      inputMatch[1],
      parseInt(inputMatch[2]),
      inputMatch[3],
      inputMatch[4],
    )
  } catch (error) {
    console.error('VEP rsID annotation failed:', error)
    return null
  }
}

function parseVepResponse(
  data: VepResponse,
  chrom: string,
  pos: number,
  ref: string,
  alt: string,
): { annotation: VariantAnnotation; vep: VepConsequence; gnomad: GnomadData } {
  let gene: string | undefined
  let transcript: string | undefined
  let refseqTranscript: string | undefined
  let hgvsC: string | undefined
  let hgvsP: string | undefined
  let consequence: string | undefined
  let impact: string | undefined
  let maneStatus: string | undefined
  let rsId: string | undefined

  // 提取 rsID
  for (const cv of data.colocated_variants || []) {
    if (cv.id?.startsWith('rs')) {
      rsId = cv.id
      break
    }
  }

  // 提取转录本信息（优先 MANE Select）
  for (const tc of data.transcript_consequences || []) {
    if (!gene && (tc.mane_select || tc.canonical)) {
      gene = tc.gene_symbol
      transcript = tc.transcript_id
      refseqTranscript = tc.refseq_transcript_id
      hgvsC = tc.hgvsc
      hgvsP = tc.hgvsp
      consequence = tc.consequence_terms?.[0]
      impact = tc.impact
      maneStatus = tc.mane_select ? 'MANE Select' : tc.canonical ? 'Canonical' : undefined
    }
    if (gene) break
  }

  // 如果没有找到 MANE/Canonical，取第一个有 hgvsP 的
  if (!gene) {
    for (const tc of data.transcript_consequences || []) {
      if (tc.hgvsp || tc.gene_symbol) {
        gene = tc.gene_symbol
        transcript = tc.transcript_id
        refseqTranscript = tc.refseq_transcript_id
        hgvsC = tc.hgvsc
        hgvsP = tc.hgvsp
        consequence = tc.consequence_terms?.[0]
        impact = tc.impact
        maneStatus = 'Other'
        break
      }
    }
  }

  // 提取预测分数
  let vepConsequence: VepConsequence = {
    mostSevereConsequence: data.most_severe_consequence,
  }

  // 优先从 MANE 转录本取分数
  for (const tc of data.transcript_consequences || []) {
    if (tc.transcript_id === transcript || tc.gene_symbol === gene) {
      vepConsequence = {
        mostSevereConsequence: data.most_severe_consequence,
        siftScore: tc.sift_score,
        polyphenScore: tc.polyphen_score,
        caddScore: tc.cadd_phred,
        revelScore: tc.revel_score,
        spliceAiDsMax: tc.splice_ai_ds_max,
        spliceAiAgMax: tc.splice_ai_ag_max,
        loftee: tc.lof === 'HC' ? 'HC' : tc.lof === 'LC' ? 'LC' : undefined,
        exonNumber: tc.exon ? parseInt(tc.exon) : undefined,
        intronNumber: tc.intron ? parseInt(tc.intron) : undefined,
      }
      break
    }
  }

  // 提取 gnomAD 频率
  let gnomadData: GnomadData = {}

  for (const cv of data.colocated_variants || []) {
    if (cv.frequencies) {
      const freqs = cv.frequencies

      const popmaxEntry = Object.entries(freqs)
        .filter(([k]) => k.startsWith('gnomad_') && !k.includes('_af') && k !== 'gnomad')
        .sort((a, b) => b[1] - a[1])[0]

      if (popmaxEntry) {
        const popName = popmaxEntry[0].replace('gnomad_', '').toUpperCase()
        gnomadData = {
          popmaxFreq: popmaxEntry[1],
          popmaxPop: popName,
          afGlobal: freqs.gnomad,
          afAfr: freqs.gnomad_afr,
          afAmr: freqs.gnomad_amr,
          afEas: freqs.gnomad_eas,
          afNfe: freqs.gnomad_nfe,
          afSas: freqs.gnomad_sas,
        }
      }
    }
  }

  // 从 ClinVar collocated 获取分类
  for (const cv of data.colocated_variants || []) {
    if (cv.clin_sig) {
      // Will be processed in ClinVar client
    }
  }

  const annotation: VariantAnnotation = {
    chromosome: chrom,
    position: pos,
    reference: ref,
    alternate: alt,
    genomeBuild: 'GRCh38',
    gene,
    transcript,
    refseqTranscript,
    hgvsC,
    hgvsP,
    rsId,
    consequence,
    impact,
    maneStatus,
  }

  return { annotation, vep: vepConsequence, gnomad: gnomadData }
}
