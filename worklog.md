---
## Task ID: 1 - frontend-chat-interface
### Work Task
Build the complete frontend chat interface for the RareHelper genomics Q&A assistant application.

### Work Summary
Successfully implemented the full chat interface with all 10 files created/modified:

**Files Modified:**
1. `src/app/globals.css` — Added brand color CSS custom properties (`--brand`, `--brand-light`, `--brand-dark`) using oklch teal values. Added custom scrollbar styling and typing dot animation keyframes. Registered brand colors in the Tailwind `@theme inline` block.

2. `src/app/layout.tsx` — Updated metadata to RareHelper branding with Chinese title/description, set `lang="zh-CN"`.

**Files Created:**
3. `src/components/chat/typing-indicator.tsx` — Animated dots using framer-motion with staggered opacity/y transitions.

4. `src/components/chat/message-bubble.tsx` — Message bubble component supporting 5 content types (text, variant_interpretation, hpo_matching, product_recommendation, disease_recommendation). Each type renders specialized placeholder card UI. Includes avatar icons (Bot/User), timestamps via date-fns with zhCN locale, and simple markdown parsing for bold/inline code.

5. `src/components/chat/welcome-screen.tsx` — Welcome/empty state with DNA icon, branding, and 4 quick-start suggestion cards (变异解读, 表型匹配, 产品推荐, HPO查询). Uses framer-motion staggered animations.

6. `src/components/chat/chat-input.tsx` — Auto-growing textarea (max 4 lines), Send/Clear buttons, Enter to send / Shift+Enter for newline, disabled state during sending, focus ring with brand color.

7. `src/components/chat/message-list.tsx` — ScrollArea-based message list with auto-scroll to bottom via useRef/useEffect. Shows WelcomeScreen when empty, TypingIndicator during loading.

8. `src/components/chat/conversation-sidebar.tsx` — Sidebar with DNA logo, "新建对话" button, conversation list with active highlighting and relative timestamps, "关于" footer link. Empty state with icon.

9. `src/components/chat/chat-layout.tsx` — Full-height layout with collapsible desktop sidebar (w-72 with transition), mobile Sheet/drawer via radix Sheet component, top bar with sidebar toggle buttons.

10. `src/app/page.tsx` — Main page composing all components with state management (messages, conversations, loading). Mock data for 3 conversations. Simulated assistant responses (1.5s delay) with content-type detection based on user input keywords. Conversation auto-creation on first message.

**Quality:**
- ESLint: 0 errors, 0 warnings
- Dev server: Compiles successfully, GET / returns 200
- All components use 'use client' directive
- Uses existing shadcn/ui components (Button, ScrollArea, Avatar, Sheet, Separator, Badge, Tooltip)
- Responsive: mobile-first with Sheet drawer for sidebar
- Teal/emerald brand color throughout, no blue/indigo

---
## Task ID: 2+3+5+6 - full-stack-developer
### Work Task
Build the complete backend API layer with LLM integration and knowledge service for the RareHelper genomics Q&A chat application.

### Work Summary

**Files Created (6 total):**

1. **`src/lib/llm-service.ts`** — LLM service using z-ai-web-dev-sdk
   - `import ZAI from 'z-ai-web-dev-sdk'` for AI completions
   - Base system prompt in Chinese for RareHelper (罕见病智能解读助手)
   - Intent-specific system prompts for variant_interpretation, hpo_matching, product_recommendation, disease_recommendation with structured JSON output format instructions
   - Conversation history management with max 20 messages
   - Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
   - JSON metadata extraction from LLM responses (finds ```json blocks or raw JSON objects)
   - Response cleaning (removes JSON blocks from display text)
   - System prompt role uses `'assistant'` (not 'system') as required by z-ai-web-dev-sdk

2. **`src/lib/knowledge-service.ts`** — Knowledge base query service
   - `searchProducts(query)`: Fuzzy search across Product name, description, keywords, indications
   - `searchHpoTerms(query)`: Fuzzy search across HPO term name, definition, keywords, synonyms
   - `searchGenes(query)`: Fuzzy search across gene symbol, full name, associated diseases
   - `searchDiseases(query)`: Fuzzy search across disease name, aliases, description, gene symbols
   - `getRelatedDiseases(hpoTermNames)`: Finds diseases matching given HPO terms, sorted by match count
   - `getRecommendedProducts(symptoms)`: Finds products relevant to given symptoms, sorted by relevance
   - All functions use `import { db } from '@/lib/db'` (Prisma SQLite)

3. **`src/app/api/conversations/route.ts`** — Conversation CRUD API
   - `GET /api/conversations`: List all conversations ordered by updatedAt desc, returns `{ conversations: [{ id, title, createdAt, updatedAt }] }`
   - `POST /api/conversations`: Create new conversation with optional title, returns created conversation (status 201)

4. **`src/app/api/conversations/[id]/route.ts`** — Single conversation operations
   - `GET /api/conversations/[id]`: Get conversation with all messages ordered by createdAt asc, returns `{ conversation, messages }`
   - `DELETE /api/conversations/[id]`: Delete conversation and all messages (cascade), returns `{ success: true }`
   - `PATCH /api/conversations/[id]`: Update conversation title, returns updated conversation
   - Uses Next.js 15 App Router `params: Promise<{ id: string }>` pattern

5. **`src/app/api/chat/route.ts`** — Main chat API (the orchestrator)
   - `POST /api/chat`: Accepts `{ conversationId?: string, message: string }`
   - Full pipeline: ensure conversation → save user message → classify intent → query knowledge base → call LLM → save assistant response
   - Auto-creates conversation if conversationId is null/empty
   - Auto-sets conversation title from first message (truncated to 20 chars)
   - Intent-specific knowledge queries:
     - variant_interpretation: searches genes + related diseases
     - hpo_matching: searches HPO terms + finds related diseases
     - product_recommendation: searches products by keywords + symptom-based recommendation
     - disease_recommendation: searches diseases + HPO-based cross-reference
   - Knowledge context prepended to user message as `[参考资料]` section
   - Returns `{ userMessage, assistantMessage, conversationId }` with full message data
   - Metadata saved as JSON string in Message.metadata field

**Files Modified (1 total):**

6. **`src/app/page.tsx`** — Updated from mock data to real API integration
   - Replaced mock conversations with `GET /api/conversations` fetch on mount
   - `handleSelectConversation`: loads messages via `GET /api/conversations/[id]` with caching
   - `handleSendMessage`: calls `POST /api/chat` with optimistic UI updates (temp messages)
   - Handles conversation ID remapping for newly created conversations
   - Error handling with user-visible error messages
   - Duplicate-send prevention via `isSendingRef` guard
   - Refreshes conversation list after each successful message

**Quality:**
- ESLint: 0 errors, 0 warnings
- Dev server: Compiles successfully, GET / returns 200, GET /api/conversations returns 200
- Prisma queries execute correctly (verified in dev.log)
- All z-ai-web-dev-sdk usage is server-side only (API routes, not client components)

---
## Task ID: 7 - P1 Structured Data Rendering
### Work Task
Update message-bubble component to render real structured data from API metadata instead of hardcoded placeholder data.

### Work Summary

**Files Modified:**

1. **`src/components/chat/message-bubble.tsx`** — Major rewrite
   - Added `metadata?: string` field to `Message` interface
   - Added `parseMetadata()` helper to safely parse JSON metadata
   - Added `getClassificationColor()` for ACMG classification badge colors (Pathogenic=red, VUS=amber, Benign=green)
   - Rewrote all content type components to accept and render metadata:
     - `VariantInterpretationContent`: Shows gene, variant, ACMG classification badge, evidence level, details from metadata
     - `HpoMatchingContent`: Shows matched HPO terms as badges with match count, summary
     - `ProductRecommendationContent`: Shows recommended products with category badges and descriptions
     - `DiseaseRecommendationContent`: Shows disease list with match scores, matched symptoms summary
   - All cards only render when metadata contains real data (graceful fallback to text-only)
   - Added `max-h-60 overflow-y-auto` for scrollable lists
   - Used `line-clamp-2` for long descriptions
   - Replaced static contentMap with dynamic `renderContent()` function using switch

2. **`src/app/page.tsx`** — Minor update
   - Added `metadata: m.metadata` when loading messages from API
   - Added `metadata: assistantMessage.metadata` when creating assistant message from API response

3. **`src/app/api/route.ts`** — Removed old placeholder API route

**Quality:**
- ESLint: 0 errors, 0 warnings
- All structured data cards render dynamically from API metadata
- Graceful degradation: if no metadata, only text content is shown (no empty cards)
- Responsive: cards have max-height with scroll overflow

---
## Task ID: 5
Agent: rag-service
Task: Create synonym service and RAG retrieval service

Work Log:
- Read worklog.md and all dependency files (knowledge-service.ts, fts5-init.ts, jieba-service.ts, prisma/schema.prisma, db.ts) to understand existing types, functions, and data models
- Created `src/lib/synonym-service.ts` with 4 exported functions:
  - `getSynonyms(term)`: Queries Synonym table by exact match (case-insensitive) + prefix match, returns deduplicated `{ term, canonical, category }[]`
  - `expandQuery(query)`: Tokenizes query with jieba `cut()`, looks up synonyms per token, returns space-separated expanded query string
  - `buildSynonymSeedData()`: Generates synonym entries from existing structured data — Gene (geneSymbol + fullName), Disease (name + aliases JSON), HpoTerm (name + hpoId + synonyms JSON)
  - `seedSynonyms(entries)`: Bulk inserts synonym data using `createMany` with `skipDuplicates`
- Created `src/lib/rag-service.ts` with 3 exported functions and 1 exported type:
  - `RAGResult` interface: `{ structured: { genes, diseases, hpoTerms, products }, documents: Fts5SearchResult[], ragContext: string }`
  - `hybridSearch(query, options)`: L2 synonym expansion → jieba tokenization → FTS5 BM25 search, with optional document type filtering
  - `buildRagContext(query, maxChunks)`: Calls hybridSearch, formats results as markdown with source citations (document name, page/sheet info), limited to maxChunks (default 8)
  - `searchKnowledgeBase(query)`: Unified search using Promise.all to run structured searches (genes, diseases, HPO terms, products) and document search in parallel
- Initialization guard `ensureInitialized()` ensures jieba + FTS5 are ready on first use
- All functions have graceful error handling with fallback strategies
- Server-side only modules (no 'use client', no browser APIs)

Stage Summary:
- Two new server-side service files created: synonym-service.ts and rag-service.ts
- Synonym service provides L2 fuzzy matching via Synonym table lookups and seed data generation from existing Gene/Disease/HPO records
- RAG service orchestrates L1 (FTS5 BM25) + L2 (synonym expansion) + structured DB queries in a unified `searchKnowledgeBase` API
- ESLint: 0 new errors (pre-existing 1 error in jieba-service.ts is unrelated)
- Dev server compiles successfully

---
## Task ID: 4
Agent: document-service
Task: Create document processing service

Work Log:
- Read worklog.md to understand project context (RareHelper genomics Q&A app)
- Read prisma/schema.prisma to understand Document and DocumentChunk models
- Read jieba-service.ts to understand tokenizeForFts5 and initJieba APIs
- Created `src/lib/document-service.ts` with comprehensive document processing pipeline:
  - **PDF parsing** (`parsePdf`): Uses `require('pdf-parse')` (CommonJS for Bun compat), splits text by `\f` form-feed into per-page arrays, falls back to single-page if no form-feeds found, extracts metadata (title, author, creator, producer, pageCount)
  - **Excel parsing** (`parseExcel`): Uses `require('xlsx')` (CommonJS for Bun compat), reads all sheets via `XLSX.readFile`, converts each row to natural language description (e.g., "Gene: BRCA1, Mutation: c.5266dupC, ACMG: Pathogenic"), handles empty sheets gracefully
  - **Smart text chunking** (`chunkText`):
    - Config: chunkSize=2000 chars, overlap=15% (300 chars)
    - Split priority: paragraphs (`\n\n`) → lines (`\n`) → sentence boundaries (Chinese/English punctuation)
    - Table detection: checks for 3+ lines with `|` or 2+ tabs, converts to natural language via `tableToNaturalLanguage`
    - Section title extraction: matches Chinese numbering (一二三), Markdown headers (#), numeric outlines (1. 1.1)
    - Each chunk preserves pageNumber, sheetName, sectionTitle, isTable flag
  - **Main pipeline** (`processDocument`):
    - Updates status to 'processing' → parses file → chunks text → tokenizes with jieba (`tokenizeForFts5`) → batch saves chunks (50 per batch) → saves full text to `textContent` → sets status to 'completed' with `processedAt` timestamp
    - Error handling: catches all errors, sets status to 'failed' with errorMessage
  - **Re-processing** (`reprocessDocument`): Deletes all existing chunks, resets document state, re-runs `processDocument`
  - **Helper** (`formatFileSize`): Converts bytes to human-readable format (B/KB/MB/GB/TB)
- Added eslint-disable comments for required CommonJS imports
- ESLint: 0 new errors in document-service.ts (pre-existing 1 error in jieba-service.ts is unrelated)

Stage Summary:
- Document processing pipeline ready for PDF and Excel files
- Smart chunking with paragraph/heading awareness and table-to-NL conversion
- jieba tokenization integrated for FTS5 indexing
- Batch chunk creation for performance (50 per batch)
- Full error handling with status tracking (pending → processing → completed/failed)

---
## Task ID: 8 - Sidebar Tabs + Knowledge Base Panel + Chat Enhancements
### Work Task
Add sidebar dual-tab navigation (Conversations / Knowledge Base), document upload UI, and chat interaction enhancements.

### Work Summary

**Files Created (1):**

1. **`src/components/chat/knowledge-panel.tsx`** — Knowledge Base management panel
   - Document list with status indicators (pending/processing/completed/failed)
   - Drag-and-drop file upload zone supporting PDF, Excel, CSV (max 50MB)
   - File picker as fallback for non-drag-drop upload
   - Document deletion with hover-reveal trash button
   - Auto-polling (3s interval) for documents in processing state
   - Stats bar showing total documents and text chunks count
   - "Initialize Knowledge Base Index" button for FTS5 rebuild
   - Graceful error handling for all API calls

**Files Modified (4):**

2. **`src/app/page.tsx`** — Major updates
   - Added `SidebarShell` component with dual-tab navigation (对话 / 知识库)
   - Tab state management (`sidebarTab`)
   - `handleRegenerate`: Removes last assistant message and resends last user query
   - Wired `onDeleteConversation` prop to `ConversationSidebar`
   - Wired `onRegenerate` prop to `MessageList`
   - Passed `KnowledgePanel` as sidebar content for "知识库" tab

3. **`src/components/chat/conversation-sidebar.tsx`** — Enhanced
   - Added `onDeleteConversation` prop for deleting conversations
   - Added `isEmbedded` prop to suppress header when used inside SidebarShell
   - Delete button appears on hover with opacity transition
   - Removed header section when embedded (header now in SidebarShell)

4. **`src/components/chat/message-bubble.tsx`** — Enhanced
   - Added `CopyButton` component with clipboard API + fallback
   - Added copy-to-clipboard for all assistant messages (hover reveal)
   - Added regenerate button on last assistant message (hover reveal)
   - Visual feedback: green checkmark after successful copy
   - Group hover effect for action buttons

5. **`src/components/chat/message-list.tsx`** — Enhanced
   - Added `onRegenerate` prop
   - Identifies last assistant message for regeneration
   - Only shows regenerate button on last assistant message

6. **`src/lib/jieba-service.ts`** — Critical fix
   - Replaced static `import nodejieba from 'nodejieba'` with dynamic `getJieba()` function
   - Uses variable-based `require('nodejieba')` to avoid Turbopack static resolution
   - Graceful fallback to regex-based tokenization when nodejieba unavailable
   - All functions (cut, cutForSearch, extractKeywords, tokenizeForFts5, tokenizeQuery) use fallback
   - Eliminated the compilation error caused by missing native module

**Quality:**
- ESLint: 0 errors, 0 warnings (all pre-existing issues resolved)
- Dev server: Compiled successfully before temporary config crash (resolved)
- All new components are responsive (mobile-first)
- Consistent with existing brand color system (teal/emerald)

---
Task ID: 1
Agent: main
Task: 实现 ACMG 变异致病性分类系统 - 参考 HerediClassify 架构

Work Log:
- 阅读 HerediClassify GitHub 仓库全部源码（36个Python文件），理解其模块化ACMG规则引擎架构
- 阅读用户上传的 main.py（变异解读主入口）和 normalizer.py（变异标准化）代码
- 更新 Prisma Schema，新增 6 个模型：DataSourceConfig, VariantAnnotation, HgmdImport, Pm1Domain, AcmgThreshold
- 实现完整 ACMG 分类引擎（TypeScript）：
  - types.ts: 类型定义（28个类型/枚举/接口）
  - rules.ts: 18条 ACMG 规则（PVS1, PS1, PS3, PS4, PM1, PM2, PM4, PM5, PP1-PP4, BA1, BS1, BS2, BP1, BP3, BP4, BP7）
  - schemata.ts: 分类组合逻辑（5个分类级别的组合规则 + 冲突检测）
  - classifier.ts: 分类器主入口（阈值管理、PM1域查询、结果缓存）
  - index.ts: 统一导出
- 实现 3 个外部 API 客户端：
  - vep-client.ts: Ensembl VEP REST API（变异注释 + gnomAD频率 + 功能预测）
  - clinvar-client.ts: NCBI ClinVar API + gnomAD Browser API
- 创建 API 路由：
  - /api/variant/classify: 完整分类流程（VEP→ClinVar→gnomAD→HGMD→ACMG规则→结果）
  - /api/datasources/config: 数据源配置管理（GET/PUT/POST）
- 创建前端组件 VariantClassificationPanel（分类表单 + 结果展示）
- 集成到侧边栏第三个Tab"变异解读"

Stage Summary:
- 完整实现了参考 HerediClassify 的 ACMG 分类引擎，使用 TypeScript 重写
- 接入了 ClinVar API、gnomAD API、VEP API 三个外部数据源
- 支持本地 HGMD 数据库和 PM1 功能域数据库
- 提供了可配置的 ACMG 阈值系统（支持按基因自定义）
- 前端组件支持 VCF/rsID 两种输入格式
- ESLint 零错误通过
