'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dna,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react'

// ==================== 类型定义 ====================

interface RuleDisplay {
  rule: string
  applied: boolean
  strength: string
  type: string
  comment: string
}

interface ClassificationResponse {
  classification: {
    level: string
    label: string
    rules: RuleDisplay[]
    evidence: {
      pathogenicVeryStrong: number
      pathogenicStrong: number
      pathogenicModerate: number
      pathogenicSupporting: number
      benignStandAlone: number
      benignStrong: number
      benignModerate: number
      benignSupporting: number
    }
  }
  annotation?: {
    gene?: string
    hgvsC?: string
    hgvsP?: string
    consequence?: string
    impact?: string
    rsId?: string
    chromosome?: string
    position?: number
    maneStatus?: string
  }
  clinvar?: {
    clinicalSignificance?: string
    reviewStatus?: string
    variationId?: string
    diseases?: string[]
  }
  gnomad?: {
    afGlobal?: number
    popmaxFreq?: number
    popmaxPop?: string
    homCount?: number
    hemiCount?: number
  }
  hgmd?: {
    accession?: string
    classType?: string
    description?: string
    gene?: string
  }
  vep?: {
    mostSevereConsequence?: string
    siftScore?: number
    polyphenScore?: number
    caddScore?: number
    revelScore?: number
    spliceAiDsMax?: number
    spliceAiAgMax?: number
  }
  elapsed?: string
  error?: string
}

// ==================== 样式常量 ====================

const CLASS_COLORS: Record<string, string> = {
  'Pathogenic': 'bg-red-500 text-white',
  'Likely Pathogenic': 'bg-orange-500 text-white',
  'VUS': 'bg-yellow-400 text-yellow-900',
  'Likely Benign': 'bg-blue-400 text-white',
  'Benign': 'bg-green-500 text-white',
}

const CLASS_BG_COLORS: Record<string, string> = {
  'Pathogenic': 'bg-red-50 border-red-200',
  'Likely Pathogenic': 'bg-orange-50 border-orange-200',
  'VUS': 'bg-yellow-50 border-yellow-200',
  'Likely Benign': 'bg-blue-50 border-blue-200',
  'Benign': 'bg-green-50 border-green-200',
}

const STRENGTH_COLORS: Record<string, string> = {
  stand_alone: 'bg-purple-100 text-purple-800',
  very_strong: 'bg-red-100 text-red-800',
  strong: 'bg-orange-100 text-orange-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  supporting: 'bg-blue-100 text-blue-800',
}

const STRENGTH_LABELS: Record<string, string> = {
  stand_alone: '独立',
  very_strong: '极强',
  strong: '强',
  moderate: '中等',
  supporting: '支持',
}

// ==================== 主组件 ====================

export function VariantClassificationPanel() {
  const [inputType, setInputType] = useState<string>('vcf')
  const [input, setInput] = useState('')
  const [result, setResult] = useState<ClassificationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedRule, setExpandedRule] = useState<string | null>(null)

  const examples = [
    { label: 'BRCA1 c.5266dupC', type: 'vcf', value: '17:43045678:G:A' },
    { label: 'rs80357713', type: 'rsid', value: 'rs80357713' },
    { label: 'DMD c.9186C>T', type: 'vcf', value: 'X:31203064:C:T' },
    { label: 'TP53 R175H', type: 'rsid', value: 'rs28934578' },
  ]

  const handleClassify = async () => {
    if (!input.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/variant/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputType, input: input.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '分类请求失败')
        return
      }

      setResult(data)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleClassify()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 输入区域 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Dna className="h-4 w-4 text-emerald-600" />
            ACMG/AMP 变异致病性分类
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Select value={inputType} onValueChange={setInputType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vcf">VCF 格式</SelectItem>
                <SelectItem value="rsid">rs 编号</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={inputType === 'vcf' ? 'chr17:43045678:G:A' : 'rs80357713'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button onClick={handleClassify} disabled={loading || !input.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              分类
            </Button>
          </div>

          {/* 示例快捷按钮 */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">示例:</span>
            {examples.map((ex) => (
              <button
                key={ex.label}
                onClick={() => {
                  setInputType(ex.type)
                  setInput(ex.value)
                }}
                className="text-xs px-2 py-0.5 rounded-md bg-muted hover:bg-muted-foreground/10 transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>

          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 加载中 */}
      {loading && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}

      {/* 结果区域 */}
      {result && !loading && (
        <div className="space-y-4">
          {/* 分类结果头部 */}
          <Card className={CLASS_BG_COLORS[result.classification.level] || 'bg-white'}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 rounded-lg text-base font-bold ${CLASS_COLORS[result.classification.level] || ''}`}>
                    {result.classification.level}
                  </div>
                  <div>
                    <div className="font-medium">{result.classification.label}</div>
                    {result.annotation?.gene && (
                      <div className="text-sm opacity-75">
                        {result.annotation.gene} · {result.annotation.hgvsC || result.annotation.hgvsP || ''}
                      </div>
                    )}
                  </div>
                </div>
                {result.elapsed && (
                  <span className="text-xs opacity-50">耗时 {result.elapsed}</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 数据库信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.clinvar && (
              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">ClinVar 数据库</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{result.clinvar.clinicalSignificance || '未分类'}</span>
                    {result.clinvar.reviewStatus && (
                      <Badge variant="outline" className="text-[10px]">{result.clinvar.reviewStatus}</Badge>
                    )}
                  </div>
                  {result.clinvar.diseases && result.clinvar.diseases.length > 0 && (
                    <div className="text-xs text-muted-foreground truncate">{result.clinvar.diseases.slice(0, 3).join('; ')}</div>
                  )}
                </CardContent>
              </Card>
            )}

            {result.gnomad && (
              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">gnomAD 人群频率</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {result.gnomad.afGlobal !== undefined ? result.gnomad.afGlobal.toExponential(3) : 'N/A'}
                    </span>
                    {result.gnomad.popmaxPop && (
                      <span className="text-xs text-muted-foreground">(Popmax: {result.gnomad.popmaxPop})</span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>Hom: {result.gnomad.homCount ?? 'N/A'}</span>
                    <span>Hemi: {result.gnomad.hemiCount ?? 'N/A'}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.hgmd && (
              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">HGMD 本地数据库</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={result.hgmd.classType === 'DM' ? 'destructive' : 'secondary'} className="text-xs">{result.hgmd.classType}</Badge>
                    <span className="text-sm">{result.hgmd.accession}</span>
                  </div>
                  {result.hgmd.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{result.hgmd.description}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {result.vep && (
              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">VEP 功能预测</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {result.vep.revelScore !== undefined && (
                      <div>REVEL: <span className="font-medium">{result.vep.revelScore.toFixed(3)}</span></div>
                    )}
                    {result.vep.caddScore !== undefined && (
                      <div>CADD: <span className="font-medium">{result.vep.caddScore.toFixed(1)}</span></div>
                    )}
                    {result.vep.siftScore !== undefined && (
                      <div>SIFT: <span className="font-medium">{result.vep.siftScore.toFixed(3)}</span></div>
                    )}
                    {result.vep.polyphenScore !== undefined && (
                      <div>PolyPhen: <span className="font-medium">{result.vep.polyphenScore.toFixed(3)}</span></div>
                    )}
                    {result.vep.spliceAiDsMax !== undefined && (
                      <div>SpliceAI: <span className="font-medium">{Math.max(result.vep.spliceAiDsMax, result.vep.spliceAiAgMax || 0).toFixed(3)}</span></div>
                    )}
                    {result.vep.mostSevereConsequence && (
                      <div>Consequence: <span className="font-medium">{result.vep.mostSevereConsequence}</span></div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ACMG 规则详情 */}
          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                ACMG 规则判定详情
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-1">
                {result.classification.rules.map((rule) => (
                  <div
                    key={rule.rule}
                    className={`rounded-lg border px-3 py-2 transition-colors ${rule.applied ? 'border-green-200 bg-green-50/50' : 'border-gray-200 opacity-60'}`}
                  >
                    <button
                      className="w-full flex items-center gap-2 text-left"
                      onClick={() => setExpandedRule(expandedRule === rule.rule ? null : rule.rule)}
                    >
                      {rule.applied ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      )}
                      <span className="font-mono text-sm font-semibold">{rule.rule}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STRENGTH_COLORS[rule.strength] || ''}`}>
                        {STRENGTH_LABELS[rule.strength] || rule.strength}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${rule.type === 'pathogenic' ? 'text-red-600 border-red-200' : 'text-blue-600 border-blue-200'}`}>
                        {rule.type === 'pathogenic' ? '致病' : '良性'}
                      </Badge>
                      <span className="flex-1" />
                      {expandedRule === rule.rule ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {expandedRule === rule.rule && (
                      <p className="mt-1.5 ml-6 text-xs text-muted-foreground leading-relaxed">{rule.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
