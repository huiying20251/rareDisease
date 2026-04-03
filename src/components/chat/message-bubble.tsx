'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot, User, ShieldAlert, Search, Package, Heart, Copy, Check, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useState, useCallback } from 'react'

// ==================== Types ====================

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  contentType:
    | 'text'
    | 'variant_interpretation'
    | 'hpo_matching'
    | 'product_recommendation'
    | 'disease_recommendation'
  createdAt: Date
  metadata?: string
}

interface MessageBubbleProps {
  message: Message
  onCopy?: (content: string) => void
  onRegenerate?: () => void
  isLoading?: boolean
}

// ==================== Helpers ====================

function formatTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true, locale: zhCN })
}

function parseMetadata(metadata?: string): Record<string, any> {
  if (!metadata) return {}
  try {
    return JSON.parse(metadata) as Record<string, any>
  } catch {
    return {}
  }
}

function getClassificationColor(classification?: string): string {
  if (!classification) return 'border-0 bg-gray-500 text-white'
  const lower = classification.toLowerCase()
  if (lower.includes('pathogenic') && !lower.includes('likely')) {
    return 'border-0 bg-red-600 text-white'
  }
  if (lower.includes('likely pathogenic')) {
    return 'border-0 bg-red-500 text-white'
  }
  if (lower.includes('vus') || lower.includes('uncertain')) {
    return 'border-0 bg-amber-500 text-white'
  }
  if (lower.includes('likely benign')) {
    return 'border-0 bg-emerald-500 text-white'
  }
  if (lower.includes('benign')) {
    return 'border-0 bg-emerald-600 text-white'
  }
  return 'border-0 bg-gray-500 text-white'
}

// ==================== Text Content ====================

function TextContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g)

  return (
    <div className="space-y-1">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <span key={i} className="font-semibold">
              {part.slice(2, -2)}
            </span>
          )
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono"
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        if (part === '\n') {
          return <br key={i} />
        }
        return <span key={i}>{part}</span>
      })}
    </div>
  )
}

// ==================== Variant Interpretation ====================

const ACMG_CLASS_COLORS: Record<string, string> = {
  'Pathogenic': 'bg-red-500 text-white',
  'Likely Pathogenic': 'bg-orange-500 text-white',
  'VUS': 'bg-yellow-400 text-yellow-900',
  'Likely Benign': 'bg-emerald-400 text-white',
  'Benign': 'bg-emerald-600 text-white',
}

const ACMG_CLASS_BG: Record<string, string> = {
  'Pathogenic': 'bg-red-50 border-red-200',
  'Likely Pathogenic': 'bg-orange-50 border-orange-200',
  'VUS': 'bg-yellow-50 border-yellow-200',
  'Likely Benign': 'bg-emerald-50 border-emerald-200',
  'Benign': 'bg-emerald-50 border-emerald-200',
}

const STRENGTH_BADGE_COLORS: Record<string, string> = {
  very_strong: 'bg-red-100 text-red-800',
  strong: 'bg-orange-100 text-orange-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  supporting: 'bg-blue-100 text-blue-800',
}

const STRENGTH_LABELS: Record<string, string> = {
  very_strong: '极强',
  strong: '强',
  moderate: '中等',
  supporting: '支持',
}

function VariantInterpretationCard({ metadata }: { metadata: Record<string, any> }) {
  const gene = metadata.gene || ''
  const variant = metadata.variant || ''
  const classification = metadata.acmgClassification || metadata.classification || ''
  const classLabel = metadata.acmgClassificationLabel || ''
  const hgvsC = metadata.hgvsC || ''
  const hgvsP = metadata.hgvsP || ''
  const clinvarSig = metadata.clinvarSignificance || ''
  const gnomadFreq = metadata.gnomadFrequency
  const appliedRules = metadata.appliedRules as string[] | undefined
  const evidenceSummary = metadata.evidenceSummary as Record<string, number> | undefined
  const consequence = metadata.consequence || ''
  const impact = metadata.impact || ''

  // Old metadata format fields
  const oldEvidenceLevel = metadata.evidenceLevel || ''
  const details = metadata.details || ''

  const hasNewFormat = !!(metadata.acmgClassification || metadata.appliedRules)
  const hasContent = !!(gene || variant || classification || hasNewFormat)

  if (!hasContent) return null

  const classBgColor = ACMG_CLASS_BG[classification] || 'bg-gray-50 border-gray-200'
  const classTextColor = ACMG_CLASS_COLORS[classification] || 'bg-gray-500 text-white'

  return (
    <div className="mt-3 space-y-3">
      {/* ACMG Classification Header */}
      {classification && (
        <div className={cn('rounded-lg border p-3.5', classBgColor)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="size-4 text-foreground/80" />
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn('px-2.5 py-0.5 rounded-md text-sm font-bold', classTextColor)}>
                    {classification}
                  </span>
                  {classLabel && (
                    <span className="text-sm font-medium text-foreground/80">{classLabel}</span>
                  )}
                </div>
                {(gene || hgvsC) && (
                  <p className="text-xs text-foreground/60 mt-0.5">
                    {gene}{gene && hgvsC ? ' · ' : ''}{hgvsC}{hgvsC && hgvsP ? ' / ' : ''}{hgvsP}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database info grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* ClinVar */}
        {clinvarSig && (
          <div className="rounded-md bg-background border p-2.5">
            <p className="text-[10px] text-muted-foreground mb-1">ClinVar</p>
            <Badge className={cn('text-[11px]', getClassificationColor(clinvarSig))}>
              {clinvarSig}
            </Badge>
          </div>
        )}
        {/* gnomAD */}
        {gnomadFreq !== undefined && gnomadFreq !== null && (
          <div className="rounded-md bg-background border p-2.5">
            <p className="text-[10px] text-muted-foreground mb-1">gnomAD AF</p>
            <p className="text-xs font-mono font-medium">
              {gnomadFreq === 0 ? '0' : gnomadFreq < 0.0001 ? gnomadFreq.toExponential(2) : gnomadFreq.toFixed(6)}
            </p>
          </div>
        )}
        {/* Consequence */}
        {consequence && (
          <div className="rounded-md bg-background border p-2.5">
            <p className="text-[10px] text-muted-foreground mb-1">变异类型</p>
            <p className="text-xs font-mono font-medium truncate">{consequence}</p>
          </div>
        )}
        {/* Impact */}
        {impact && (
          <div className="rounded-md bg-background border p-2.5">
            <p className="text-[10px] text-muted-foreground mb-1">影响等级</p>
            <p className="text-xs font-mono font-medium">{impact}</p>
          </div>
        )}
      </div>

      {/* Applied ACMG Rules */}
      {appliedRules && appliedRules.length > 0 && (
        <div className="rounded-lg border border-brand/20 bg-brand-light/30 p-3">
          <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
            <ShieldAlert className="size-3" />
            已应用的 ACMG 规则
          </p>
          <div className="flex flex-wrap gap-1.5">
            {appliedRules.map((rule) => {
              // Determine badge style from rule prefix
              const strength = rule.startsWith('PVS') ? 'very_strong'
                : rule.startsWith('PS') ? 'strong'
                : rule.startsWith('PM') ? 'moderate'
                : rule.startsWith('PP') ? 'supporting'
                : rule.startsWith('BA') ? 'stand_alone'
                : rule.startsWith('BS') ? 'strong'
                : 'supporting'
              return (
                <Badge
                  key={rule}
                  variant="outline"
                  className={cn('text-[11px] font-mono font-medium', STRENGTH_BADGE_COLORS[strength])}
                >
                  {rule}
                </Badge>
              )
            })}
          </div>
        </div>
      )}

      {/* Evidence Summary */}
      {evidenceSummary && (
        <div className="rounded-md bg-background border p-3">
          <p className="text-[10px] text-muted-foreground mb-2">证据汇总</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {evidenceSummary.pathogenicVeryStrong > 0 && (
              <p>致病·极强: <span className="font-bold text-red-600">{evidenceSummary.pathogenicVeryStrong}</span></p>
            )}
            {evidenceSummary.pathogenicStrong > 0 && (
              <p>致病·强: <span className="font-bold text-orange-600">{evidenceSummary.pathogenicStrong}</span></p>
            )}
            {evidenceSummary.pathogenicModerate > 0 && (
              <p>致病·中等: <span className="font-bold text-yellow-600">{evidenceSummary.pathogenicModerate}</span></p>
            )}
            {evidenceSummary.pathogenicSupporting > 0 && (
              <p>致病·支持: <span className="font-bold text-blue-600">{evidenceSummary.pathogenicSupporting}</span></p>
            )}
            {evidenceSummary.benignStandAlone > 0 && (
              <p>良性·独立: <span className="font-bold text-emerald-600">{evidenceSummary.benignStandAlone}</span></p>
            )}
            {evidenceSummary.benignStrong > 0 && (
              <p>良性·强: <span className="font-bold text-emerald-600">{evidenceSummary.benignStrong}</span></p>
            )}
            {evidenceSummary.benignModerate > 0 && (
              <p>良性·中等: <span className="font-bold text-emerald-500">{evidenceSummary.benignModerate}</span></p>
            )}
            {evidenceSummary.benignSupporting > 0 && (
              <p>良性·支持: <span className="font-bold text-emerald-400">{evidenceSummary.benignSupporting}</span></p>
            )}
          </div>
        </div>
      )}

      {/* Legacy: old format fields */}
      {!hasNewFormat && (
        <>
          {(gene || variant) && !classification && (
            <div className="rounded-lg border border-brand/20 bg-brand-light/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="size-4 text-brand-dark" />
                <span className="text-sm font-semibold">ACMG 致病性评级</span>
              </div>
              <div className="rounded-md bg-background p-2.5">
                <span className="text-sm text-muted-foreground">变异位点: </span>
                <span className="text-sm font-medium font-mono">
                  {gene}{gene && variant ? ' ' : ''}{variant}
                </span>
              </div>
            </div>
          )}
          {oldEvidenceLevel && (
            <div className="rounded-md bg-background border p-2.5">
              <span className="text-sm text-muted-foreground">证据等级: </span>
              <Badge variant="outline" className="border-amber-400 text-amber-700">{oldEvidenceLevel}</Badge>
            </div>
          )}
          {details && (
            <p className="text-xs text-muted-foreground leading-relaxed">{details}</p>
          )}
        </>
      )}
    </div>
  )
}

function VariantInterpretationContent({ content, metadata }: { content: string; metadata: Record<string, any> }) {
  return (
    <div className="space-y-3">
      <TextContent content={content} />
      <VariantInterpretationCard metadata={metadata} />
    </div>
  )
}

// ==================== HPO Matching ====================

function HpoMatchingCard({ metadata }: { metadata: Record<string, any> }) {
  const matchedTerms = metadata.matchedTerms as Array<{ hpoId: string; name: string; score?: number }> | undefined
  const summary = metadata.summary as string | undefined

  if (!matchedTerms || matchedTerms.length === 0) return null

  return (
    <div className="mt-3 rounded-lg border border-brand/20 bg-brand-light/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Search className="size-4 text-brand-dark" />
        <span className="text-sm font-semibold">HPO 表型匹配</span>
        <Badge variant="secondary" className="ml-auto border-brand/30 bg-brand-light text-brand-dark text-xs">
          {matchedTerms.length} 项匹配
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {matchedTerms.map((term) => (
          <Badge
            key={term.hpoId}
            variant="secondary"
            className="border-brand/30 bg-brand-light text-brand-dark"
          >
            {term.hpoId} - {term.name}
          </Badge>
        ))}
      </div>
      {summary && (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          {summary}
        </p>
      )}
    </div>
  )
}

function HpoMatchingContent({ content, metadata }: { content: string; metadata: Record<string, any> }) {
  return (
    <div className="space-y-3">
      <TextContent content={content} />
      <HpoMatchingCard metadata={metadata} />
    </div>
  )
}

// ==================== Product Recommendation ====================

function ProductRecommendationCard({ metadata }: { metadata: Record<string, any> }) {
  const products = metadata.products as Array<{ name: string; category: string; description?: string }> | undefined
  const recommendation = metadata.recommendation as string | undefined

  if (!products || products.length === 0) return null

  return (
    <div className="mt-3 rounded-lg border border-brand/20 bg-brand-light/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Package className="size-4 text-brand-dark" />
        <span className="text-sm font-semibold">推荐检测产品</span>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {products.map((product, index) => (
          <div key={`${product.name}-${index}`} className="rounded-md bg-background p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{product.name}</span>
              <Badge variant="outline" className="text-[10px] border-brand/30 text-brand-dark">
                {product.category}
              </Badge>
            </div>
            {product.description && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {product.description}
              </p>
            )}
          </div>
        ))}
      </div>
      {recommendation && (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          {recommendation}
        </p>
      )}
    </div>
  )
}

function ProductRecommendationContent({ content, metadata }: { content: string; metadata: Record<string, any> }) {
  return (
    <div className="space-y-3">
      <TextContent content={content} />
      <ProductRecommendationCard metadata={metadata} />
    </div>
  )
}

// ==================== Disease Recommendation ====================

function DiseaseRecommendationCard({ metadata }: { metadata: Record<string, any> }) {
  const diseases = metadata.diseases as Array<{ name: string; omimId?: string; score?: number }> | undefined
  const matchedSymptoms = metadata.matchedSymptoms as string[] | undefined

  if (!diseases || diseases.length === 0) return null

  return (
    <div className="mt-3 rounded-lg border border-brand/20 bg-brand-light/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Heart className="size-4 text-brand-dark" />
        <span className="text-sm font-semibold">疾病智能推荐</span>
        <Badge variant="secondary" className="ml-auto border-brand/30 bg-brand-light text-brand-dark text-xs">
          {diseases.length} 项结果
        </Badge>
      </div>

      {matchedSymptoms && matchedSymptoms.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">匹配症状:</span>
          {matchedSymptoms.map((s, i) => (
            <Badge key={i} variant="outline" className="text-[10px] border-border">
              {s}
            </Badge>
          ))}
        </div>
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {diseases.map((disease, index) => (
          <div
            key={`${disease.name}-${index}`}
            className="flex items-center justify-between rounded-md bg-background p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{disease.name}</p>
              {disease.omimId && (
                <p className="text-xs text-muted-foreground">
                  OMIM: {disease.omimId}
                </p>
              )}
            </div>
            {disease.score && (
              <Badge className="border-0 bg-brand text-white shrink-0 ml-2">
                {disease.score}%
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function DiseaseRecommendationContent({ content, metadata }: { content: string; metadata: Record<string, any> }) {
  return (
    <div className="space-y-3">
      <TextContent content={content} />
      <DiseaseRecommendationCard metadata={metadata} />
    </div>
  )
}

// ==================== Copy Button ====================

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [content])

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className="size-7 text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </Button>
  )
}

// ==================== Message Bubble ====================

export function MessageBubble({ message, onCopy, onRegenerate, isLoading }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const metadata = parseMetadata(message.metadata)

  function renderContent() {
    switch (message.contentType) {
      case 'variant_interpretation':
        return <VariantInterpretationContent content={message.content} metadata={metadata} />
      case 'hpo_matching':
        return <HpoMatchingContent content={message.content} metadata={metadata} />
      case 'product_recommendation':
        return <ProductRecommendationContent content={message.content} metadata={metadata} />
      case 'disease_recommendation':
        return <DiseaseRecommendationContent content={message.content} metadata={metadata} />
      default:
        return <TextContent content={message.content} />
    }
  }

  return (
    <div
      className={cn('group flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      <Avatar
        className={cn(
          'size-8 shrink-0',
          isUser ? 'bg-brand' : 'bg-brand-light'
        )}
      >
        <AvatarFallback
          className={cn(
            isUser
              ? 'bg-brand text-white'
              : 'bg-brand-light text-brand-dark'
          )}
        >
          {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          'flex max-w-[80%] flex-col gap-1',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-md bg-brand text-white'
              : 'rounded-tl-md bg-muted text-foreground'
          )}
        >
          {renderContent()}
        </div>
        <div className="flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
          {!isUser && (
            <div className="flex items-center gap-0.5 ml-1">
              <CopyButton content={message.content} />
              {onRegenerate && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRegenerate}
                  disabled={isLoading}
                  className="size-7 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
