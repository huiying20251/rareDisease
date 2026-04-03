'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot, User, ShieldAlert, Search, Package, Heart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

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

function VariantInterpretationCard({ metadata }: { metadata: Record<string, any> }) {
  const gene = metadata.gene || ''
  const variant = metadata.variant || ''
  const classification = metadata.classification || ''
  const evidenceLevel = metadata.evidenceLevel || ''
  const details = metadata.details || ''

  if (!gene && !variant && !classification) return null

  return (
    <div className="mt-3 rounded-lg border border-brand/20 bg-brand-light/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert className="size-4 text-brand-dark" />
        <span className="text-sm font-semibold">ACMG 致病性评级</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {(gene || variant) && (
          <div className="flex items-center justify-between rounded-md bg-background p-2.5">
            <span className="text-sm text-muted-foreground">变异位点</span>
            <span className="text-sm font-medium font-mono">
              {gene}{gene && variant ? ' ' : ''}{variant}
            </span>
          </div>
        )}
        {classification && (
          <div className="flex items-center justify-between rounded-md bg-background p-2.5">
            <span className="text-sm text-muted-foreground">评级结果</span>
            <Badge className={getClassificationColor(classification)}>
              {classification}
            </Badge>
          </div>
        )}
        {evidenceLevel && (
          <div className="flex items-center justify-between rounded-md bg-background p-2.5">
            <span className="text-sm text-muted-foreground">证据等级</span>
            <Badge
              variant="outline"
              className="border-amber-400 text-amber-700"
            >
              {evidenceLevel}
            </Badge>
          </div>
        )}
      </div>
      {details && (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          {details}
        </p>
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

// ==================== Message Bubble ====================

export function MessageBubble({ message }: MessageBubbleProps) {
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
      className={cn('flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}
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
        <span className="px-1 text-[10px] text-muted-foreground">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}
