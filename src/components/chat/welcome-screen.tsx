'use client'

import { Dna } from 'lucide-react'
import { motion } from 'framer-motion'

interface WelcomeScreenProps {
  onSuggestionClick: (text: string) => void
}

const suggestions = [
  {
    icon: '🔍',
    title: '变异解读',
    description: '帮我解读 BRCA1 c.5266dupC 这个变异的致病性',
  },
  {
    icon: '🧬',
    title: '表型匹配',
    description: '患者表现为智力障碍、癫痫和肌张力低下，请帮我匹配可能的疾病',
  },
  {
    icon: '📋',
    title: '产品推荐',
    description: '我想了解全外显子组测序(WES)的详细信息',
  },
  {
    icon: '🏥',
    title: '疾病查询',
    description: '马凡综合征有哪些临床表现和遗传特征？',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
}

export function WelcomeScreen({ onSuggestionClick }: WelcomeScreenProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <motion.div
        className="flex flex-col items-center gap-4 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Logo & Title */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center gap-3"
        >
          <div className="flex size-16 items-center justify-center rounded-2xl bg-brand/10">
            <Dna className="size-9 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              RareHelper
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              罕见病智能解读助手
            </p>
          </div>
        </motion.div>

        {/* Description */}
        <motion.p
          variants={itemVariants}
          className="max-w-md text-sm text-muted-foreground"
        >
          对话式变异致病性解读(ACMG评级) · 表型驱动的疾病智能推荐
        </motion.p>

        {/* Suggestion Cards */}
        <motion.div
          variants={itemVariants}
          className="mt-4 grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick(suggestion.description)}
              className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-brand/40 hover:bg-brand-light/30 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{suggestion.icon}</span>
                <span className="text-sm font-medium text-foreground">
                  {suggestion.title}
                </span>
              </div>
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {suggestion.description}
              </p>
            </button>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
