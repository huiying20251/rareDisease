import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { initFts5, rebuildFts5Index } from '@/lib/fts5-init'
import { buildSynonymSeedData } from '@/lib/synonym-service'

/**
 * POST /api/knowledge/init - Initialize FTS5 and seed synonyms
 */
export async function POST() {
  try {
    // Step 1: Initialize FTS5
    await initFts5()

    // Step 2: Rebuild FTS5 index
    await rebuildFts5Index()

    // Step 3: Seed synonyms
    const synonyms = buildSynonymSeedData()

    if (synonyms && synonyms.length > 0) {
      // Insert synonyms using findFirst + create/update pattern
      for (const synonym of synonyms) {
        try {
          const existing = await db.synonym.findFirst({
            where: {
              term: synonym.term,
              category: synonym.category,
            },
          })
          if (existing) {
            await db.synonym.update({
              where: { id: existing.id },
              data: { canonical: synonym.canonical },
            })
          } else {
            await db.synonym.create({ data: synonym })
          }
        } catch {
          // Continue on individual failures
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `知识库初始化完成。FTS5 已就绪，${synonyms?.length ?? 0} 条同义词已加载。`,
    })
  } catch (error: unknown) {
    console.error('Knowledge init failed:', error)
    const message = error instanceof Error ? error.message : '知识库初始化失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
