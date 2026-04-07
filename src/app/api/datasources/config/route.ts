import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/datasources/config
 * 获取所有数据源配置
 */
export async function GET() {
  try {
    const configs = await db.dataSourceConfig.findMany({
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      success: true,
      dataSources: configs.map(c => ({
        id: c.id,
        name: c.name,
        sourceType: c.sourceType,
        enabled: c.enabled,
        config: JSON.parse(c.config || '{}'),
        description: c.description,
        lastSyncAt: c.lastSyncAt,
        syncStatus: c.syncStatus,
        syncError: c.syncError,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch datasource configs:', error)
    return NextResponse.json({ error: '获取数据源配置失败' }, { status: 500 })
  }
}

/**
 * PUT /api/datasources/config
 * 更新数据源配置
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, enabled, config, description } = body

    if (!name) {
      return NextResponse.json({ error: '数据源名称不能为空' }, { status: 400 })
    }

    const updated = await db.dataSourceConfig.upsert({
      where: { name },
      create: {
        name,
        sourceType: body.sourceType || 'api',
        enabled: enabled ?? true,
        config: JSON.stringify(config || {}),
        description: description || '',
      },
      update: {
        enabled: enabled !== undefined ? enabled : undefined,
        config: config ? JSON.stringify(config) : undefined,
        description: description !== undefined ? description : undefined,
      },
    })

    return NextResponse.json({ success: true, dataSource: updated })
  } catch (error) {
    console.error('Failed to update datasource config:', error)
    return NextResponse.json({ error: '更新数据源配置失败' }, { status: 500 })
  }
}

/**
 * POST /api/datasources/config/init
 * 初始化默认数据源配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body.action

    if (action === 'init_defaults') {
      const defaults = [
        {
          name: 'vep_api',
          sourceType: 'api',
          enabled: true,
          config: JSON.stringify({
            baseUrl: 'https://rest.ensembl.org',
            species: 'human',
            timeout: 30000,
          }),
          description: 'Ensembl VEP (Variant Effect Predictor) - 变异注释',
        },
        {
          name: 'clinvar_api',
          sourceType: 'api',
          enabled: true,
          config: JSON.stringify({
            baseUrl: 'https://api.ncbi.nlm.nih.gov/clinvar',
            eutilsUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
            rateLimit: 3,
          }),
          description: 'NCBI ClinVar - 变异临床意义数据库',
        },
        {
          name: 'gnomad_api',
          sourceType: 'api',
          enabled: true,
          config: JSON.stringify({
            baseUrl: 'https://gnomad.broadinstitute.org/api',
            dataset: 'gnomad_r4',
          }),
          description: 'gnomAD - 人群等位基因频率数据库',
        },
        {
          name: 'hgmd_local',
          sourceType: 'local_db',
          enabled: false,
          config: JSON.stringify({}),
          description: 'HGMD 本地数据库 - 人类基因突变数据库',
        },
        {
          name: 'pm1_local',
          sourceType: 'local_db',
          enabled: true,
          config: JSON.stringify({}),
          description: 'PM1 关键功能域本地数据库',
        },
      ]

      const results = []
      for (const d of defaults) {
        const result = await db.dataSourceConfig.upsert({
          where: { name: d.name },
          create: d,
          update: {
            description: d.description,
          },
        })
        results.push(result.name)
      }

      return NextResponse.json({ success: true, initialized: results })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error) {
    console.error('Failed to init datasource configs:', error)
    return NextResponse.json({ error: '初始化失败' }, { status: 500 })
  }
}
