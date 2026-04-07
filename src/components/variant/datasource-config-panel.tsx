'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Database,
  Globe,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Settings,
} from 'lucide-react'

// ==================== 类型定义 ====================

interface DataSourceItem {
  id: string
  name: string
  sourceType: string
  enabled: boolean
  config: Record<string, unknown>
  description: string | null
  lastSyncAt: string | null
  syncStatus: string
  syncError: string | null
}

// ==================== 常量 ====================

const SOURCE_TYPE_LABELS: Record<string, string> = {
  api: 'API',
  local_db: '本地数据库',
  file: '文件',
}

const SOURCE_TYPE_ICONS: Record<string, React.ReactNode> = {
  api: <Globe className="h-4 w-4" />,
  local_db: <HardDrive className="h-4 w-4" />,
  file: <Database className="h-4 w-4" />,
}

const SYNC_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  idle: {
    label: '空闲',
    color: 'text-muted-foreground bg-muted',
    icon: <Clock className="h-3 w-3" />,
  },
  syncing: {
    label: '同步中',
    color: 'text-blue-600 bg-blue-50',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  success: {
    label: '正常',
    color: 'text-emerald-600 bg-emerald-50',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  failed: {
    label: '失败',
    color: 'text-red-600 bg-red-50',
    icon: <XCircle className="h-3 w-3" />,
  },
}

// ==================== 主组件 ====================

export function DatasourceConfigPanel() {
  const [dataSources, setDataSources] = useState<DataSourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingName, setTogglingName] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(false)

  const fetchDataSources = useCallback(async () => {
    try {
      const response = await fetch('/api/datasources/config')
      if (!response.ok) throw new Error('获取数据源配置失败')
      const data = await response.json()
      setDataSources(data.dataSources || [])
    } catch {
      console.error('Failed to fetch datasource configs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDataSources()
  }, [fetchDataSources])

  const handleToggle = async (ds: DataSourceItem) => {
    setTogglingName(ds.name)
    try {
      const response = await fetch('/api/datasources/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ds.name, enabled: !ds.enabled }),
      })
      if (!response.ok) throw new Error('更新失败')
      setDataSources((prev) =>
        prev.map((item) =>
          item.name === ds.name ? { ...item, enabled: !item.enabled } : item
        )
      )
    } catch {
      console.error('Failed to toggle datasource:', ds.name)
    } finally {
      setTogglingName(null)
    }
  }

  const handleInitDefaults = async () => {
    setInitializing(true)
    try {
      const response = await fetch('/api/datasources/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init_defaults' }),
      })
      if (!response.ok) throw new Error('初始化失败')
      await fetchDataSources()
    } catch {
      console.error('Failed to init default configs')
    } finally {
      setInitializing(false)
    }
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '从未同步'
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ==================== 加载状态 ====================

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-9 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // ==================== 渲染 ====================

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Settings className="h-4 w-4" />
          <span>管理变异分类所使用的外部数据源</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleInitDefaults}
          disabled={initializing}
          className="text-xs"
        >
          {initializing ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1.5" />
          )}
          初始化默认配置
        </Button>
      </div>

      {/* 数据源列表 */}
      <div className="space-y-2">
        {dataSources.map((ds) => {
          const syncConfig = SYNC_STATUS_CONFIG[ds.syncStatus] || SYNC_STATUS_CONFIG.idle
          const typeIcon = SOURCE_TYPE_ICONS[ds.sourceType] || <Database className="h-4 w-4" />
          const typeLabel = SOURCE_TYPE_LABELS[ds.sourceType] || ds.sourceType

          return (
            <Card
              key={ds.id}
              className={`transition-colors ${!ds.enabled ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {/* 类型图标 */}
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted text-muted-foreground shrink-0">
                    {typeIcon}
                  </div>

                  {/* 信息区域 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{ds.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        {typeLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 font-normal ${syncConfig.color}`}
                      >
                        <span className="flex items-center gap-1">
                          {syncConfig.icon}
                          {syncConfig.label}
                        </span>
                      </Badge>
                    </div>
                    {ds.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {ds.description}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      最后同步: {formatTime(ds.lastSyncAt)}
                    </p>
                    {ds.syncError && (
                      <p className="text-[10px] text-red-500 mt-0.5 truncate">
                        错误: {ds.syncError}
                      </p>
                    )}
                  </div>

                  {/* 启用开关 */}
                  <div className="shrink-0">
                    <Switch
                      checked={ds.enabled}
                      onCheckedChange={() => handleToggle(ds)}
                      disabled={togglingName === ds.name}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {dataSources.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <Database className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">暂无数据源配置</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                点击「初始化默认配置」添加数据源
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
