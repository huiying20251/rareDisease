import { db } from '@/lib/db'

// ==================== Helper Functions ====================

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function fuzzyMatch(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some((kw) => lower.includes(kw.toLowerCase()))
}

// ==================== Search Types ====================

export interface ProductResult {
  id: string
  name: string
  category: string
  description: string
  features: string[]
  keywords: string[]
  indications: string[]
}

export interface HpoTermResult {
  id: string
  hpoId: string
  name: string
  category: string | null
  definition: string | null
  keywords: string[]
  synonyms: string[]
}

export interface GeneResult {
  id: string
  geneSymbol: string
  fullName: string | null
  description: string | null
  omimId: string | null
  hgncId: string | null
  associatedDiseases: string[]
  phenotypeIds: string[]
}

export interface DiseaseResult {
  id: string
  omimId: string | null
  name: string
  aliases: string[]
  description: string | null
  inheritance: string[]
  phenotypeIds: string[]
  geneSymbols: string[]
  prevalence: string | null
}

// ==================== Product Search ====================

/**
 * Search products by keywords matching name, description, keywords, indications
 */
export async function searchProducts(query: string): Promise<ProductResult[]> {
  if (!query || query.trim().length === 0) return []

  const products = await db.product.findMany({
    where: { isActive: true },
  })

  const keywords = query.trim().split(/\s+/)

  return products
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      features: safeJsonParse<string[]>(p.features, []),
      keywords: safeJsonParse<string[]>(p.keywords, []),
      indications: safeJsonParse<string[]>(p.indications, []),
    }))
    .filter((p) => {
      const searchText = [p.name, p.description, ...p.keywords, ...p.indications].join(' ')
      return fuzzyMatch(searchText, keywords)
    })
}

// ==================== HPO Term Search ====================

/**
 * Search HPO terms by keywords matching name, keywords, synonyms, definition
 */
export async function searchHpoTerms(query: string): Promise<HpoTermResult[]> {
  if (!query || query.trim().length === 0) return []

  const terms = await db.hpoTerm.findMany()
  const keywords = query.trim().split(/\s+/)

  return terms
    .map((t) => ({
      id: t.id,
      hpoId: t.hpoId,
      name: t.name,
      category: t.category,
      definition: t.definition,
      keywords: safeJsonParse<string[]>(t.keywords, []),
      synonyms: safeJsonParse<string[]>(t.synonyms, []),
    }))
    .filter((t) => {
      const searchText = [t.name, t.definition ?? '', ...t.keywords, ...t.synonyms].join(' ')
      return fuzzyMatch(searchText, keywords)
    })
}

// ==================== Gene Search ====================

/**
 * Search genes by gene symbol, full name, associated diseases
 */
export async function searchGenes(query: string): Promise<GeneResult[]> {
  if (!query || query.trim().length === 0) return []

  const genes = await db.gene.findMany()
  const keywords = query.trim().split(/\s+/)

  return genes
    .map((g) => ({
      id: g.id,
      geneSymbol: g.geneSymbol,
      fullName: g.fullName,
      description: g.description,
      omimId: g.omimId,
      hgncId: g.hgncId,
      associatedDiseases: safeJsonParse<string[]>(g.associatedDiseases, []),
      phenotypeIds: safeJsonParse<string[]>(g.phenotypeIds, []),
    }))
    .filter((g) => {
      const searchText = [
        g.geneSymbol,
        g.fullName ?? '',
        g.description ?? '',
        ...g.associatedDiseases,
      ].join(' ')
      return fuzzyMatch(searchText, keywords)
    })
}

// ==================== Disease Search ====================

/**
 * Search diseases by name, aliases, description, gene symbols
 */
export async function searchDiseases(query: string): Promise<DiseaseResult[]> {
  if (!query || query.trim().length === 0) return []

  const diseases = await db.disease.findMany()
  const keywords = query.trim().split(/\s+/)

  return diseases
    .map((d) => ({
      id: d.id,
      omimId: d.omimId,
      name: d.name,
      aliases: safeJsonParse<string[]>(d.aliases, []),
      description: d.description,
      inheritance: safeJsonParse<string[]>(d.inheritance, []),
      phenotypeIds: safeJsonParse<string[]>(d.phenotypeIds, []),
      geneSymbols: safeJsonParse<string[]>(d.geneSymbols, []),
      prevalence: d.prevalence,
    }))
    .filter((d) => {
      const searchText = [
        d.name,
        d.description ?? '',
        ...d.aliases,
        ...d.geneSymbols,
      ].join(' ')
      return fuzzyMatch(searchText, keywords)
    })
}

// ==================== Related Diseases by HPO Terms ====================

/**
 * Find diseases that match given HPO term symptoms
 * @param hpoTermNames - Array of HPO term names or IDs to match against
 */
export async function getRelatedDiseases(
  hpoTermNames: string[]
): Promise<DiseaseResult[]> {
  if (!hpoTermNames || hpoTermNames.length === 0) return []

  const allDiseases = await db.disease.findMany()

  return allDiseases
    .map((d) => {
      const phenotypeIds = safeJsonParse<string[]>(d.phenotypeIds, [])
      const aliases = safeJsonParse<string[]>(d.aliases, [])
      const geneSymbols = safeJsonParse<string[]>(d.geneSymbols, [])
      const inheritance = safeJsonParse<string[]>(d.inheritance, [])

      // Count how many of the given HPO terms match this disease's phenotypes
      const matchCount = hpoTermNames.filter((term) => {
        // Match by HPO ID directly
        if (phenotypeIds.some((pid) => pid.toLowerCase().includes(term.toLowerCase()))) {
          return true
        }
        // Match by name in aliases
        if (aliases.some((a) => a.toLowerCase().includes(term.toLowerCase()))) {
          return true
        }
        return false
      }).length

      return {
        id: d.id,
        omimId: d.omimId,
        name: d.name,
        aliases,
        description: d.description,
        inheritance,
        phenotypeIds,
        geneSymbols,
        prevalence: d.prevalence,
        matchCount,
      }
    })
    .filter((d) => d.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
}

// ==================== Recommended Products by Symptoms ====================

/**
 * Find products relevant to given symptoms
 * @param symptoms - Array of symptom descriptions
 */
export async function getRecommendedProducts(
  symptoms: string[]
): Promise<ProductResult[]> {
  if (!symptoms || symptoms.length === 0) return []

  const allProducts = await db.product.findMany({
    where: { isActive: true },
  })

  return allProducts
    .map((p) => {
      const features = safeJsonParse<string[]>(p.features, [])
      const keywords = safeJsonParse<string[]>(p.keywords, [])
      const indications = safeJsonParse<string[]>(p.indications, [])

      const searchText = [p.name, p.description, ...features, ...keywords, ...indications].join(' ')

      const matchCount = symptoms.filter((symptom) =>
        searchText.toLowerCase().includes(symptom.toLowerCase())
      ).length

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        features,
        keywords,
        indications,
        matchCount,
      }
    })
    .filter((p) => p.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
}
