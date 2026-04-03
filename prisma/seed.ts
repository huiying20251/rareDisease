import { db } from '../src/lib/db'

async function main() {
  console.log('🌱 开始填充种子数据...\n')

  // ==================== 清理旧数据 ====================
  console.log('🗑️  清理旧数据...')
  await db.disease.deleteMany()
  await db.gene.deleteMany()
  await db.hpoTerm.deleteMany()
  await db.product.deleteMany()
  console.log('✅ 旧数据已清理\n')

  // ==================== 1. 产品知识库 ====================
  console.log('📦 填充产品数据...')

  const products = await db.product.createMany({
    data: [
      {
        name: '全外显子组测序 (WES)',
        category: 'WES',
        description:
          '全外显子组测序（Whole Exome Sequencing）通过捕获并测序基因组中约20,000个蛋白质编码基因的外显子区域，覆盖人类基因组约1-2%的区域，却能解释约85%的已知致病性变异。适用于不明原因的罕见病诊断、复杂遗传病筛查以及疑似单基因病的分子诊断。',
        features: JSON.stringify([
          '覆盖约20,000个蛋白质编码基因',
          '平均测序深度≥100X',
          '变异检出率>99%',
          '内含子侧翼区域覆盖',
          'SNV/Indel精准检测',
          'ACMG指南变异分类报告',
          '典型报告周期15-20个工作日',
        ]),
        keywords: JSON.stringify([
          'WES',
          '全外显子',
          '外显子测序',
          '全外显子组测序',
          '罕见病诊断',
          '不明原因疾病',
        ]),
        indications: JSON.stringify([
          '不明原因的发育迟缓或智力障碍',
          '多发畸形综合征',
          '疑似遗传性代谢病',
          '自闭症谱系障碍',
          '疑似单基因遗传病',
          '家族中有类似病史的先证者',
          '反复流产或死胎的遗传学评估',
        ]),
        isActive: true,
      },
      {
        name: '全基因组测序 (WGS)',
        category: 'WGS',
        description:
          '全基因组测序（Whole Genome Sequencing）对完整的基因组进行高通量测序，可全面检测SNV、Indel、CNV、SV、线粒体变异及三核苷酸重复扩展等多种变异类型。相比WES，WGS能检测非编码区的调控元件变异、结构变异和深度内含子变异，是目前最全面的基因组分析方案。',
        features: JSON.stringify([
          '全基因组覆盖（30X PCR-Free）',
          '检测SNV/Indel/CNV/SV多种变异类型',
          '非编码区变异分析',
          '线粒体基因组同步测序',
          '三核苷酸重复扩展检测',
          'ACMG/AMP指南变异分类',
          '典型报告周期20-25个工作日',
        ]),
        keywords: JSON.stringify([
          'WGS',
          '全基因组',
          '全基因组测序',
          '基因组分析',
          '结构变异',
          '非编码区',
        ]),
        indications: JSON.stringify([
          'WES阴性但临床高度怀疑遗传病',
          '疑似结构变异导致的疾病',
          '需要全面基因组分析的情况',
          '疑难罕见病的最终诊断手段',
          '非编码区变异筛查',
        ]),
        isActive: true,
      },
      {
        name: '心肌病基因Panel',
        category: 'Panel',
        description:
          '针对遗传性心肌病的靶向基因Panel检测，涵盖肥厚型心肌病（HCM）、扩张型心肌病（DCM）、致心律失常性右室心肌病（ARVC）及限制型心肌病（RCM）等主要类型。覆盖100+个心脏相关基因，为临床精准诊断和家族遗传咨询提供依据。',
        features: JSON.stringify([
          '覆盖100+个心肌病相关基因',
          '平均测序深度≥200X',
          '支持SNV/Indel检测',
          '包含MLPA验证CNV',
          '家族成员级联检测方案',
          '遗传咨询配套服务',
          '典型报告周期10-15个工作日',
        ]),
        keywords: JSON.stringify([
          '心肌病',
          '肥厚型心肌病',
          'HCM',
          '扩张型心肌病',
          'DCM',
          '心脏Panel',
          '基因Panel',
        ]),
        indications: JSON.stringify([
          '肥厚型心肌病（HCM）',
          '扩张型心肌病（DCM）',
          '致心律失常性右室心肌病（ARVC）',
          '限制型心肌病（RCM）',
          '青年猝死风险评估',
          '心肌病家族史筛查',
        ]),
        isActive: true,
      },
      {
        name: '肌病基因Panel',
        category: 'Panel',
        description:
          '针对遗传性肌肉疾病的综合基因检测Panel，涵盖进行性肌营养不良、先天性肌病、肌强直性肌病、代谢性肌病和离子通道病等亚型。覆盖150+个肌病相关基因，为进行性肌无力、肌酸激酶升高等临床表现提供精准分子诊断。',
        features: JSON.stringify([
          '覆盖150+个肌病相关基因',
          '平均测序深度≥200X',
          '支持DMD基因大片段缺失/重复分析',
          'SNV/Indel/CNV综合检测',
          'MLPA验证关键基因',
          '典型报告周期10-15个工作日',
        ]),
        keywords: JSON.stringify([
          '肌病',
          '肌营养不良',
          'DMD',
          '肌无力',
          '肌肉疾病',
          '肌酸激酶升高',
          'CK升高',
        ]),
        indications: JSON.stringify([
          '进行性肌营养不良',
          '杜氏/贝氏肌营养不良',
          '先天性肌病',
          '肢带型肌营养不良',
          '肌强直性肌病',
          '不明原因的肌酸激酶升高',
          '代谢性肌病',
        ]),
        isActive: true,
      },
      {
        name: '智力障碍与发育迟缓基因Panel',
        category: 'Panel',
        description:
          '针对智力障碍（ID）和全面发育迟缓（GDD）的综合基因Panel，涵盖500+个与神经发育相关的基因。适用于不明原因的智力障碍、语言发育迟缓、运动发育迟缓和自闭症谱系障碍等临床场景。',
        features: JSON.stringify([
          '覆盖500+个神经发育相关基因',
          '平均测序深度≥200X',
          'SNV/Indel/CNV综合检测',
          '包含脆性X综合征FMR1基因三核苷酸重复分析',
          'ACMG变异分类报告',
          '典型报告周期12-18个工作日',
        ]),
        keywords: JSON.stringify([
          '智力障碍',
          '发育迟缓',
          'ID',
          'GDD',
          '语言迟缓',
          '认知障碍',
          '精神发育迟滞',
        ]),
        indications: JSON.stringify([
          '不明原因的智力障碍',
          '全面发育迟缓（GDD）',
          '语言发育迟缓',
          '运动发育迟缓',
          '自闭症谱系障碍',
          '学习障碍伴其他先天异常',
        ]),
        isActive: true,
      },
      {
        name: '拷贝数变异 (CNV) 分析',
        category: 'CNV分析',
        description:
          '基于高通量测序数据的拷贝数变异（Copy Number Variation）分析，可检测基因组中≥1kb的缺失和重复。适用于微缺失/微重复综合征筛查、染色体失衡检测以及WES/WGS数据中CNV的补充分析。',
        features: JSON.stringify([
          '分辨率可达1kb',
          '支持全基因组CNV检测',
          '基于测序数据的算法分析',
          'MLPA或qPCR验证',
          '与WES数据联合分析',
          '典型报告周期7-10个工作日',
        ]),
        keywords: JSON.stringify([
          'CNV',
          '拷贝数变异',
          '微缺失',
          '微重复',
          '基因缺失',
          '基因重复',
          '拷贝数',
        ]),
        indications: JSON.stringify([
          '疑似微缺失/微重复综合征',
          '发育迟缓伴多发畸形',
          '自闭症谱系障碍',
          '不明原因的智力障碍',
          '先天性异常筛查',
          '反复流产的遗传学评估',
        ]),
        isActive: true,
      },
      {
        name: 'Sanger测序验证',
        category: 'Sanger验证',
        description:
          'Sanger测序（一代测序）作为分子诊断的金标准，用于验证高通量测序发现的候选致病性变异。具有准确率高、成本低、周期短的特点，适用于已知位点验证、家系共分离分析和产前诊断。',
        features: JSON.stringify([
          '准确率>99.9%',
          '单片段最长800bp',
          '支持家系共分离分析',
          '适用于已知位点验证',
          '可作为产前诊断依据',
          '典型报告周期5-7个工作日',
        ]),
        keywords: JSON.stringify([
          'Sanger',
          '一代测序',
          'Sanger验证',
          '验证测序',
          '金标准',
          '家系验证',
        ]),
        indications: JSON.stringify([
          'NGS检测到的候选变异验证',
          '家系成员共分离分析',
          '已知致病位点检测',
          '产前基因诊断',
          '携带者筛查确认',
          '科研验证实验',
        ]),
        isActive: true,
      },
      {
        name: '药物基因组学检测',
        category: '药物基因组学',
        description:
          '基于药物基因组学的个体化用药基因检测，涵盖心血管药物、精神类药物、抗肿瘤药物、抗感染药物等多个治疗领域的关键药物代谢酶和药物靶点基因。为临床合理用药和剂量调整提供遗传学依据，减少药物不良反应。',
        features: JSON.stringify([
          '覆盖50+个药物基因组学相关基因',
          '涵盖100+种药物的代谢信息',
          '基于CPIC指南的用药建议',
          'STAR/DPWG数据库支持',
          '个体化用药报告',
          '典型报告周期5-7个工作日',
        ]),
        keywords: JSON.stringify([
          '药物基因组学',
          '个体化用药',
          '用药指导',
          '药物代谢',
          '基因用药',
          '精准用药',
          '不良反应',
        ]),
        indications: JSON.stringify([
          '抗凝药物（华法林、氯吡格雷）用药指导',
          '他汀类药物安全性与疗效评估',
          '精神类药物剂量调整',
          '抗肿瘤药物代谢评估',
          '儿童用药安全评估',
          '多次用药失败或不良反应史',
        ]),
        isActive: true,
      },
      {
        name: '染色体微阵列分析 (CMA)',
        category: 'CMA',
        description:
          '染色体微阵列分析（Chromosomal Microarray Analysis）是国际推荐的一线遗传学检测技术，可检测全基因组范围内>50-100kb的微缺失和微重复。作为不明原因发育迟缓/智力障碍、多发畸形和自闭症的首选检测方法。',
        features: JSON.stringify([
          '全基因组范围内高分辨率检测',
          '检测分辨率50-100kb',
          '可检测微缺失/微重复',
          '可检测单亲二倍体（UPD）',
          '国际推荐一线检测技术',
          '典型报告周期7-10个工作日',
        ]),
        keywords: JSON.stringify([
          'CMA',
          '染色体微阵列',
          '微阵列分析',
          '芯片分析',
          '基因芯片',
          '染色体芯片',
        ]),
        indications: JSON.stringify([
          '不明原因的发育迟缓/智力障碍',
          '自闭症谱系障碍',
          '多发先天畸形',
          '超声发现的胎儿结构异常',
          '不明原因的生长迟缓',
          '反复流产的遗传学评估',
        ]),
        isActive: true,
      },
      {
        name: '线粒体基因组测序',
        category: '线粒体测序',
        description:
          '线粒体基因组全长测序（mtDNA），可检测线粒体基因组中的点突变、缺失和异质性水平。适用于线粒体病的分子诊断，包括线粒体脑肌病、Leber遗传性视神经病变、MELAS综合征、MERRF综合征等。',
        features: JSON.stringify([
          '线粒体基因组全长16.5kb覆盖',
          '平均测序深度≥1000X',
          '异质性水平检测（阈值1%）',
          'mtDNA大片段缺失检测',
          '核基因线粒体病Panel可选',
          '典型报告周期10-15个工作日',
        ]),
        keywords: JSON.stringify([
          '线粒体',
          '线粒体病',
          'mtDNA',
          '线粒体基因组',
          '母系遗传',
          '能量代谢障碍',
        ]),
        indications: JSON.stringify([
          '疑似线粒体病',
          'MELAS综合征',
          'MERRF综合征',
          'Leber遗传性视神经病变（LHON）',
          '线粒体脑肌病',
          '不明原因的多系统受累',
          '乳酸升高伴能量代谢障碍',
        ]),
        isActive: true,
      },
    ],
  })

  console.log(`✅ 已创建 ${products.count} 个产品\n`)

  // ==================== 2. HPO 表型词条 ====================
  console.log('🧬 填充HPO表型词条...')

  const hpoTerms = await db.hpoTerm.createMany({
    data: [
      {
        hpoId: 'HP:0001249',
        name: '智力障碍',
        category: '神经系统',
        definition:
          '智力功能显著低于平均水平，伴随适应性行为缺陷，在发育期内表现出来。IQ<70，影响日常生活技能和社会适应能力。',
        keywords: JSON.stringify([
          '智力低下',
          '智力障碍',
          '智力发育迟缓',
          '精神发育迟滞',
          '认知障碍',
          '智障',
          'MR',
          '智力减退',
          'IQ低',
        ]),
        synonyms: JSON.stringify([
          '智力低下',
          '精神发育迟滞',
          '智力发育迟缓',
          '认知功能减退',
        ]),
      },
      {
        hpoId: 'HP:0001250',
        name: '癫痫',
        category: '神经系统',
        definition:
          '以反复发作为特征的慢性神经系统疾病，由大脑神经元异常放电引起。可表现为全面性发作或局灶性发作。',
        keywords: JSON.stringify([
          '癫痫',
          '抽搐',
          '惊厥',
          '羊癫疯',
          '痫性发作',
          '癫痫发作',
          '抽风',
          '癫间',
        ]),
        synonyms: JSON.stringify(['抽搐', '惊厥', '痫性发作']),
      },
      {
        hpoId: 'HP:0001252',
        name: '肌张力低下',
        category: '神经系统',
        definition:
          '肌肉在静止状态下的张力减低，表现为肢体松软、关节活动范围增大、运动发育迟缓。是多种神经系统疾病的常见表现。',
        keywords: JSON.stringify([
          '肌张力低下',
          '肌张力低',
          '肌张力减退',
          '低肌张力',
          '松软婴儿',
          'floppy',
          '肌松软',
        ]),
        synonyms: JSON.stringify(['肌张力减退', '低肌张力', '松软儿']),
      },
      {
        hpoId: 'HP:0008872',
        name: '生长迟缓',
        category: '生长发育',
        definition:
          '身高或体重低于同年龄同性别儿童的第3百分位或低于两个标准差，可由遗传、内分泌、营养或遗传综合征等多种因素引起。',
        keywords: JSON.stringify([
          '生长迟缓',
          '身材矮小',
          '发育迟缓',
          '长不高',
          '矮小症',
          '生长缓慢',
          '身高低于正常',
          '生长落后',
        ]),
        synonyms: JSON.stringify([
          '身材矮小',
          '矮小症',
          '发育落后',
          '生长落后',
        ]),
      },
      {
        hpoId: 'HP:0001627',
        name: '先天性心脏病',
        category: '心血管系统',
        definition:
          '在胎儿期心脏及大血管发育异常所导致的心脏结构缺陷，包括房间隔缺损、室间隔缺损、动脉导管未闭、法洛四联症等类型。',
        keywords: JSON.stringify([
          '先天性心脏病',
          '先心病',
          '心脏畸形',
          '房间隔缺损',
          '室间隔缺损',
          '动脉导管未闭',
          '心脏缺陷',
          'CHD',
        ]),
        synonyms: JSON.stringify(['先心病', '心脏结构异常', '心脏畸形']),
      },
      {
        hpoId: 'HP:0000252',
        name: '小头畸形',
        category: '生长发育',
        definition:
          '头围低于同年龄同性别儿童的第3百分位或低于3个标准差，提示脑发育异常。可由遗传因素、宫内感染、缺血缺氧等多种原因引起。',
        keywords: JSON.stringify([
          '小头畸形',
          '小头',
          '头围小',
          '头小畸形',
          '脑发育不全',
        ]),
        synonyms: JSON.stringify(['小头', '头围偏小']),
      },
      {
        hpoId: 'HP:0000717',
        name: '自闭症谱系障碍',
        category: '神经系统',
        definition:
          '以社会交往障碍、沟通困难和重复刻板行为为核心特征的神经发育障碍性疾病，谱系范围从轻度到重度不等。',
        keywords: JSON.stringify([
          '自闭症',
          '孤独症',
          '自闭症谱系',
          'ASD',
          '阿斯伯格',
          '社交障碍',
          '刻板行为',
        ]),
        synonyms: JSON.stringify(['孤独症', '自闭症谱系障碍', 'ASD']),
      },
      {
        hpoId: 'HP:0002650',
        name: '脊柱侧弯',
        category: '骨骼系统',
        definition:
          '脊柱在冠状面上的侧方弯曲，Cobb角≥10度。可分为特发性、先天性及神经肌肉型等类型，严重时需手术矫正。',
        keywords: JSON.stringify([
          '脊柱侧弯',
          '脊柱侧凸',
          '侧弯',
          'scoliosis',
          '脊柱弯曲',
        ]),
        synonyms: JSON.stringify(['脊柱侧凸', '脊柱弯曲']),
      },
      {
        hpoId: 'HP:0000510',
        name: '视网膜色素变性',
        category: '眼部异常',
        definition:
          '以视网膜光感受器细胞进行性变性为特征的遗传性眼病，临床表现为夜盲、进行性视野缩小，最终可导致失明。',
        keywords: JSON.stringify([
          '视网膜色素变性',
          'RP',
          '夜盲',
          '视网膜变性',
          '视力下降',
          '视野缩小',
        ]),
        synonyms: JSON.stringify(['RP', '视网膜变性']),
      },
      {
        hpoId: 'HP:0000407',
        name: '感音神经性耳聋',
        category: '听力异常',
        definition:
          '由内耳毛细胞、听神经或听觉传导通路病变引起的听力减退，可分为先天性和后天性，可伴或不伴其他系统异常。',
        keywords: JSON.stringify([
          '耳聋',
          '听力下降',
          '听力减退',
          '听力障碍',
          '听力损失',
          '聋',
          '感音神经性聋',
          '先天性耳聋',
        ]),
        synonyms: JSON.stringify([
          '听力损失',
          '听力障碍',
          '感音神经性听力损失',
        ]),
      },
      {
        hpoId: 'HP:0002240',
        name: '肝肿大',
        category: '代谢系统',
        definition:
          '肝脏体积增大，可由感染、代谢性疾病、血液系统疾病或遗传性贮积病等多种原因引起。体检可触及肝脏肋下超过正常范围。',
        keywords: JSON.stringify([
          '肝肿大',
          '肝脏肿大',
          '肝大',
          ' hepatomegaly',
          '肝脏增大',
        ]),
        synonyms: JSON.stringify(['肝脏肿大', '肝大']),
      },
      {
        hpoId: 'HP:0000079',
        name: '肾脏异常',
        category: '泌尿系统',
        definition:
          '肾脏结构或功能的异常，包括肾脏形态异常（多囊肾、肾发育不良）、位置异常、肾积水及肾功能异常等。',
        keywords: JSON.stringify([
          '肾脏异常',
          '肾脏畸形',
          '多囊肾',
          '肾发育不良',
          '肾功能异常',
          '肾积水',
          '肾脏疾病',
        ]),
        synonyms: JSON.stringify(['肾脏畸形', '肾脏病变']),
      },
      {
        hpoId: 'HP:0000200',
        name: '面部畸形',
        category: '面部特征',
        definition:
          '面部结构发育异常，包括面部不对称、特殊面容（如前额突出、眼距增宽、鼻梁低平等），是多种遗传综合征的重要诊断线索。',
        keywords: JSON.stringify([
          '面部畸形',
          '面部异常',
          '特殊面容',
          '面容异常',
          '面部发育不良',
          '面部不对称',
          '五官异常',
        ]),
        synonyms: JSON.stringify(['特殊面容', '面容异常', '面部异常']),
      },
      {
        hpoId: 'HP:0001508',
        name: '多指/趾',
        category: '骨骼系统',
        definition:
          '手或足的指（趾）数目增多，是最常见的肢体畸形之一。可分为轴前型（桡侧/胫侧）、轴后型（尺侧/腓侧）和中央型。可为孤立畸形或综合征的一部分。',
        keywords: JSON.stringify([
          '多指',
          '多趾',
          '多指趾',
          '六指',
          '多余手指',
          '多余脚趾',
          'polydactyly',
        ]),
        synonyms: JSON.stringify(['多指畸形', '多趾畸形']),
      },
      {
        hpoId: 'HP:0001156',
        name: '短指/趾',
        category: '骨骼系统',
        definition:
          '手指或脚趾长度短于正常范围，可累及单个或多个指（趾），是多种骨骼发育不良和遗传综合征的常见表现。',
        keywords: JSON.stringify([
          '短指',
          '短趾',
          '短指趾',
          '手指短',
          '脚趾短',
          '指短',
          'brachydactyly',
        ]),
        synonyms: JSON.stringify(['短指畸形', '短趾畸形']),
      },
      {
        hpoId: 'HP:0000953',
        name: '皮肤异常色素沉着',
        category: '皮肤系统',
        definition:
          '皮肤色素异常增多或分布异常，表现为色素沉着斑、咖啡牛奶斑、色素减退斑等。是神经纤维瘤病、结节性硬化症等疾病的标志性表现。',
        keywords: JSON.stringify([
          '色素沉着',
          '咖啡牛奶斑',
          '色素异常',
          '皮肤色素',
          '牛奶咖啡斑',
          'café-au-lait',
          '雀斑样痣',
          '胎记',
        ]),
        synonyms: JSON.stringify([
          '咖啡牛奶斑',
          '色素异常',
          '皮肤色素沉着',
        ]),
      },
      {
        hpoId: 'HP:0004322',
        name: '语言发育迟缓',
        category: '神经系统',
        definition:
          '语言理解和/或表达能力显著落后于同龄儿童预期水平，包括语言表达迟缓、语言理解迟缓和构音障碍等亚型。',
        keywords: JSON.stringify([
          '语言发育迟缓',
          '语言迟缓',
          '说话晚',
          '不说话',
          '语言障碍',
          '言语发育落后',
          '吐字不清',
        ]),
        synonyms: JSON.stringify([
          '语言迟缓',
          '言语发育迟缓',
          '语言发育落后',
        ]),
      },
      {
        hpoId: 'HP:0001638',
        name: '肥厚型心肌病',
        category: '心血管系统',
        definition:
          '以心室壁不对称性肥厚为特征的遗传性心肌病，可引起左室流出道梗阻、心律失常和猝死。是最常见的遗传性心血管疾病之一。',
        keywords: JSON.stringify([
          '肥厚型心肌病',
          'HCM',
          '心肌肥厚',
          '心脏肥厚',
          '室间隔肥厚',
          '梗阻性心肌病',
        ]),
        synonyms: JSON.stringify(['HCM', '心肌肥厚', '特发性肥厚型主动脉瓣下狭窄']),
      },
      {
        hpoId: 'HP:0001251',
        name: '共济失调',
        category: '神经系统',
        definition:
          '由于小脑、本体感觉或前庭系统功能障碍导致的运动协调障碍，表现为步态不稳、意向性震颤、眼球震颤和构音障碍等。',
        keywords: JSON.stringify([
          '共济失调',
          '走路不稳',
          '平衡障碍',
          '意向性震颤',
          '运动失调',
          '步态不稳',
          '走路摇晃',
        ]),
        synonyms: JSON.stringify(['运动失调', '平衡障碍', '步态不稳']),
      },
    ],
  })

  console.log(`✅ 已创建 ${hpoTerms.count} 个HPO表型词条\n`)

  // ==================== 3. 基因信息 ====================
  console.log('🧪 填充基因数据...')

  const genes = await db.gene.createMany({
    data: [
      {
        geneSymbol: 'BRCA1',
        fullName: 'BRCA1 DNA repair associated',
        description:
          'BRCA1基因编码一种参与DNA双链断裂修复的肿瘤抑制蛋白。该基因胚系突变显著增加乳腺癌和卵巢癌的发病风险，是遗传性乳腺癌卵巢癌综合征（HBOC）的主要致病基因。约5-10%的乳腺癌与BRCA1/2胚系突变相关。',
        omimId: '113705',
        hgncId: 'HGNC:1100',
        associatedDiseases: JSON.stringify([
          '遗传性乳腺癌卵巢癌综合征',
          '家族性乳腺癌',
          '卵巢癌',
          '前列腺癌（BRCA1相关）',
        ]),
        phenotypeIds: JSON.stringify([
          'HP:0003002',
          'HP:0003003',
          'HP:0002664',
        ]),
      },
      {
        geneSymbol: 'BRCA2',
        fullName: 'BRCA2 DNA repair associated',
        description:
          'BRCA2基因编码一种参与同源重组修复的肿瘤抑制蛋白。BRCA2突变携带者终生乳腺癌累积风险约45-70%，卵巢癌风险约10-30%。该基因还与胰腺癌、前列腺癌和黑色素瘤等肿瘤风险增加相关。',
        omimId: '600185',
        hgncId: 'HGNC:1101',
        associatedDiseases: JSON.stringify([
          '遗传性乳腺癌卵巢癌综合征',
          '家族性乳腺癌',
          '卵巢癌',
          '胰腺癌（BRCA2相关）',
          '前列腺癌（BRCA2相关）',
        ]),
        phenotypeIds: JSON.stringify([
          'HP:0003002',
          'HP:0003003',
          'HP:0002664',
        ]),
      },
      {
        geneSymbol: 'TP53',
        fullName: 'Tumor protein p53',
        description:
          'TP53基因编码p53蛋白，是最重要的肿瘤抑制基因之一，被称为"基因组守护者"。Li-Fraumeni综合征由TP53胚系突变引起，患者终生患多种恶性肿瘤的风险极高，包括肉瘤、乳腺癌、脑肿瘤、肾上腺皮质癌和白血病等。',
        omimId: '191170',
        hgncId: 'HGNC:11998',
        associatedDiseases: JSON.stringify([
          'Li-Fraumeni综合征',
          '骨肉瘤',
          '软组织肉瘤',
          '肾上腺皮质癌',
          '早发性乳腺癌',
        ]),
        phenotypeIds: JSON.stringify([
          'HP:0002664',
          'HP:0003002',
          'HP:0004322',
        ]),
      },
      {
        geneSymbol: 'CFTR',
        fullName: 'Cystic fibrosis transmembrane conductance regulator',
        description:
          'CFTR基因编码氯离子通道蛋白，其突变导致囊性纤维化（CF），是白种人群中最常见的致死性常染色体隐性遗传病。在中国人群中，CF相对罕见，但DFNA8/DFNA10型常染色体显性遗传性非综合征性耳聋与该基因部分变异相关。超过2000种CFTR变异已被报道。',
        omimId: '602421',
        hgncId: 'HGNC:1884',
        associatedDiseases: JSON.stringify([
          '囊性纤维化',
          '先天性双侧输精管缺如',
          'CFTR相关疾病',
        ]),
        phenotypeIds: JSON.stringify([
          'HP:0000772',
          'HP:0004402',
          'HP:0001945',
        ]),
      },
      {
        geneSymbol: 'DMD',
        fullName: 'Dystrophin',
        description:
          'DMD基因是人类最大的基因之一（2.4Mb，79个外显子），编码抗肌萎缩蛋白（Dystrophin）。该基因突变导致杜氏肌营养不良（DMD）和贝氏肌营养不良（BMD），分别表现为严重的X连锁隐性遗传进行性肌营养不良。约1/3为新发突变。',
        omimId: '300377',
        hgncId: 'HGNC:2928',
        associatedDiseases: JSON.stringify([
          '杜氏肌营养不良',
          '贝氏肌营养不良',
          'X连锁扩张型心肌病',
        ]),
        phenotypeIds: JSON.stringify([
          'HP:0001252',
          'HP:0003236',
          'HP:0001250',
          'HP:0001324',
          'HP:0001638',
        ]),
      },
      {
        geneSymbol: 'NF1',
        fullName: 'Neurofibromin 1',
        description:
          'NF1基因编码神经纤维蛋白，是一种RAS-GTP酶激活蛋白，负调控RAS信号通路。NF1胚系突变导致I型神经纤维瘤病（von Recklinghausen病），发病率约1/3000，是最常见的常染色体显性遗传疾病之一。约50%为新发突变。',
        omimId: '613113',
        hgncId: 'HGNC:7765',
        associatedDiseases: JSON.stringify([
          'I型神经纤维瘤病',
          '视神经胶质瘤',
          '嗜铬细胞瘤',
          '恶性周围神经鞘瘤',
        ]),
        phenotypeIds: JSON.stringify([
          'HP:0000953',
          'HP:0001250',
          'HP:0000252',
          'HP:0001249',
          'HP:0002650',
        ]),
      },
      {
        geneSymbol: 'RET',
        fullName: 'RET proto-oncogene',
        description:
          'RET基因编码酪氨酸激酶受体，胚系激活突变导致多发性内分泌腺瘤2型（MEN2），包括MEN2A、MEN2B和家族性甲状腺髓样癌（FMTC）。RET突变是甲状腺髓样癌的重要分子标志物，携带者需行预防性甲状腺切除术。',
        omimId: '164761',
        hgncId: 'HGNC:9967',
        associatedDiseases: JSON.stringify([
          '多发性内分泌腺瘤2A型',
          '多发性内分泌腺瘤2B型',
          '家族性甲状腺髓样癌',
          '先天性巨结肠症（Hirschsprung病）',
        ]),
        phenotypeIds: JSON.stringify([
          'HP:0000821',
          'HP:0002866',
          'HP:0002664',
        ]),
      },
      {
        geneSymbol: 'FBN1',
        fullName: 'Fibrillin 1',
        description:
          'FBN1基因编码原纤维蛋白-1，是细胞外基质微纤维的主要结构成分。FBN1突变导致马凡综合征（MFS），是一种累及骨骼、心血管和眼部的常染色体显性遗传性结缔组织病。发病率约1/5000-1/10000。',
        omimId: '134797',
        hgncId: 'HGNC:3603',
        associatedDiseases: JSON.stringify([
          '马凡综合征',
          'Weill-Marchesani综合征',
          '晶状体异位',
          '主动脉瘤',
        ]),
        phenotypeIds: JSON.stringify([
          'HP:0000501',
          'HP:0001638',
          'HP:0001156',
          'HP:0002650',
          'HP:0004970',
        ]),
      },
      {
        geneSymbol: 'MYH7',
        fullName: 'Myosin heavy chain 7',
        description:
          'MYH7基因编码β-肌球蛋白重链，是心肌和骨骼肌慢肌纤维的主要结构蛋白。该基因突变是肥厚型心肌病（HCM）和扩张型心肌病（DCM）最常见的致病基因之一，也与非综合征性肌病相关。',
        omimId: '160760',
        hgncId: 'HGNC:7577',
        associatedDiseases: JSON.stringify([
          '家族性肥厚型心肌病',
          '扩张型心肌病',
          '左室致密化不全',
          '肌球蛋白储积性肌病',
          'Laing远端肌病',
        ]),
        phenotypeIds: JSON.stringify([
          'HP:0001638',
          'HP:0001952',
          'HP:0001252',
          'HP:0004761',
        ]),
      },
      {
        geneSymbol: 'SCN1A',
        fullName: 'Sodium voltage-gated channel alpha subunit 1',
        description:
          'SCN1A基因编码电压门控钠通道Nav1.1的α亚基，主要表达于 inhibitory 中间神经元。该基因功能丧失性突变导致Dravet综合征（婴儿严重肌阵挛癫痫），功能获得性突变与家族性偏瘫型偏头痛和热性惊厥相关。是癫痫遗传学中最重要的基因之一。',
        omimId: '182389',
        hgncId: 'HGNC:10585',
        associatedDiseases: JSON.stringify([
          'Dravet综合征',
          '全身性癫痫伴热性惊厥附加症（GEFS+）',
          '家族性偏瘫型偏头痛',
          '良性家族性婴儿癫痫',
        ]),
        phenotypeIds: JSON.stringify([
          'HP:0001250',
          'HP:0001249',
          'HP:0001252',
          'HP:0002063',
          'HP:0000717',
        ]),
      },
    ],
  })

  console.log(`✅ 已创建 ${genes.count} 个基因\n`)

  // ==================== 4. 疾病信息 ====================
  console.log('🏥 填充疾病数据...')

  const diseases = await db.disease.createMany({
    data: [
      {
        omimId: '154700',
        name: '马凡综合征',
        aliases: JSON.stringify([
          'Marfan syndrome',
          'MFS',
          '马凡',
          '蜘蛛指综合征',
        ]),
        description:
          '马凡综合征是一种常染色体显性遗传性结缔组织病，由FBN1基因突变引起。主要累及心血管系统（主动脉根部扩张、主动脉夹层）、骨骼系统（身材高大、蜘蛛指、脊柱侧弯）和眼部（晶状体异位）。自然病程中主动脉夹层破裂是主要死因，早期诊断和规范管理可显著改善预后。发病率约1/5000-1/10000。',
        inheritance: JSON.stringify(['常染色体显性遗传']),
        phenotypeIds: JSON.stringify([
          'HP:0000501',
          'HP:0003179',
          'HP:0001638',
          'HP:0001156',
          'HP:0002650',
          'HP:0004970',
          'HP:0001083',
          'HP:0001088',
        ]),
        geneSymbols: JSON.stringify(['FBN1']),
        prevalence: '1/5,000 - 1/10,000',
      },
      {
        omimId: '219700',
        name: '囊性纤维化',
        aliases: JSON.stringify([
          'Cystic fibrosis',
          'CF',
          '粘稠物阻塞症',
          '囊性纤维变性',
        ]),
        description:
          '囊性纤维化是由CFTR基因突变引起的常染色体隐性遗传病，主要影响呼吸系统、消化系统和生殖系统。临床表现为慢性咳嗽、反复肺部感染、胰腺外分泌功能不全、脂肪泻和生长发育迟缓等。在白种人群中发病率约1/2500，中国人群中极为罕见。',
        inheritance: JSON.stringify(['常染色体隐性遗传']),
        phenotypeIds: JSON.stringify([
          'HP:0000772',
          'HP:0004402',
          'HP:0001945',
          'HP:0002795',
          'HP:0008872',
          'HP:0001744',
        ]),
        geneSymbols: JSON.stringify(['CFTR']),
        prevalence: '1/2,500（白种人群），中国人群罕见',
      },
      {
        omimId: '310200',
        name: '杜氏肌营养不良',
        aliases: JSON.stringify([
          'Duchenne muscular dystrophy',
          'DMD',
          '杜氏肌营养不良',
          '假肥大型肌营养不良',
        ]),
        description:
          '杜氏肌营养不良（DMD）是由DMD基因突变引起的X连锁隐性遗传性进行性肌营养不良，是最常见的致死性遗传性肌病。男性发病率约1/3500-1/5000。患儿通常3-5岁起病，表现为进行性近端肌无力、Gowers征阳性，12岁前丧失行走能力，20-30岁死于呼吸衰竭或心力衰竭。血清肌酸激酶（CK）显著升高（正常值50-100倍）。',
        inheritance: JSON.stringify(['X连锁隐性遗传']),
        phenotypeIds: JSON.stringify([
          'HP:0001252',
          'HP:0003236',
          'HP:0001249',
          'HP:0001250',
          'HP:0001324',
          'HP:0001638',
          'HP:0002814',
        ]),
        geneSymbols: JSON.stringify(['DMD']),
        prevalence: '1/3,500 - 1/5,000（男性）',
      },
      {
        omimId: '162200',
        name: 'I型神经纤维瘤病',
        aliases: JSON.stringify([
          'Neurofibromatosis type 1',
          'NF1',
          'von Recklinghausen病',
          '神经纤维瘤',
          '多发神经纤维瘤',
        ]),
        description:
          'I型神经纤维瘤病（NF1）是由NF1基因突变引起的常染色体显性遗传病，发病率约1/3000，是最常见的单基因遗传病之一。主要临床特征包括：多发咖啡牛奶斑、皮肤和丛状神经纤维瘤、Lisch虹膜错构瘤、腋窝/腹股沟雀斑、骨发育异常和肿瘤易感性增加。约50%为新发突变。患者终生有发生恶性周围神经鞘瘤等恶性肿瘤的风险。',
        inheritance: JSON.stringify(['常染色体显性遗传']),
        phenotypeIds: JSON.stringify([
          'HP:0000953',
          'HP:0001250',
          'HP:0000252',
          'HP:0001249',
          'HP:0002650',
          'HP:0009765',
          'HP:0001480',
          'HP:0001067',
        ]),
        geneSymbols: JSON.stringify(['NF1']),
        prevalence: '1/3,000',
      },
      {
        omimId: '613254',
        name: '结节性硬化症',
        aliases: JSON.stringify([
          'Tuberous sclerosis complex',
          'TSC',
          ' Bourneville病',
          '结节性硬化',
          'TSC1/TSC2相关疾病',
        ]),
        description:
          '结节性硬化症（TSC）是由TSC1或TSC2基因突变引起的常染色体显性遗传性多系统疾病，影响皮肤、神经系统、肾脏、心脏和肺等多个器官。主要临床特征包括：面部血管纤维瘤、癫痫发作、智力障碍、皮质结节、室管膜下巨细胞星形细胞瘤（SEGA）、肾脏血管平滑肌脂肪瘤和心脏横纹肌瘤。',
        inheritance: JSON.stringify(['常染色体显性遗传']),
        phenotypeIds: JSON.stringify([
          'HP:0001250',
          'HP:0001249',
          'HP:0000953',
          'HP:0000200',
          'HP:0001256',
          'HP:0000079',
          'HP:0001638',
          'HP:0008572',
        ]),
        geneSymbols: JSON.stringify(['TSC1', 'TSC2']),
        prevalence: '1/6,000 - 1/10,000',
      },
      {
        omimId: '253300',
        name: '脊肌萎缩症',
        aliases: JSON.stringify([
          'Spinal muscular atrophy',
          'SMA',
          '脊髓性肌萎缩',
          '脊肌萎缩',
          '运动神经元病',
        ]),
        description:
          '脊肌萎缩症（SMA）是由SMN1基因纯合缺失或突变引起的常染色体隐性遗传性运动神经元病，是婴幼儿最常见的致死性遗传病之一。根据发病年龄和严重程度分为I型（Werdnig-Hoffmann病）、II型、III型（Kugelberg-Welander病）和IV型。SMA致病基因SMN1位于5q13，其相邻的SMN2基因拷贝数可修饰疾病严重程度。',
        inheritance: JSON.stringify(['常染色体隐性遗传']),
        phenotypeIds: JSON.stringify([
          'HP:0001252',
          'HP:0001324',
          'HP:0008872',
          'HP:0003701',
          'HP:0006508',
          'HP:0003546',
        ]),
        geneSymbols: JSON.stringify(['SMN1']),
        prevalence: '1/6,000 - 1/10,000（活产儿）',
      },
      {
        omimId: '604370',
        name: '遗传性乳腺癌卵巢癌综合征',
        aliases: JSON.stringify([
          'Hereditary breast and ovarian cancer syndrome',
          'HBOC',
          '遗传性乳腺癌',
          'BRCA相关肿瘤综合征',
        ]),
        description:
          '遗传性乳腺癌卵巢癌综合征（HBOC）主要由BRCA1和BRCA2基因胚系突变引起，呈常染色体显性遗传，具有不完全外显率。BRCA1突变携带者终生乳腺癌累积风险65-85%，卵巢癌风险39-63%；BRCA2突变携带者乳腺癌风险45-70%，卵巢癌风险10-30%。该综合征还与前列腺癌、胰腺癌和黑色素瘤风险增加相关。',
        inheritance: JSON.stringify(['常染色体显性遗传']),
        phenotypeIds: JSON.stringify([
          'HP:0003002',
          'HP:0003003',
          'HP:0002664',
          'HP:0000831',
          'HP:0004322',
        ]),
        geneSymbols: JSON.stringify(['BRCA1', 'BRCA2']),
        prevalence: '约1/300 - 1/500（BRCA1/2突变携带率）',
      },
      {
        omimId: '142900',
        name: 'Holt-Oram综合征',
        aliases: JSON.stringify([
          'Holt-Oram syndrome',
          '心手综合征',
          'HOS',
          '心脏-肢体综合征',
        ]),
        description:
          'Holt-Oram综合征是由TBX5基因突变引起的常染色体显性遗传性疾病，以先天性心脏病和上肢畸形为主要特征。心脏畸形以房间隔缺损（ASD）和室间隔缺损（VSD）最常见，上肢畸形可累及拇指、腕骨和桡骨，严重程度不一。',
        inheritance: JSON.stringify(['常染色体显性遗传']),
        phenotypeIds: JSON.stringify([
          'HP:0001627',
          'HP:0001156',
          'HP:0001171',
          'HP:0009601',
          'HP:0001642',
          'HP:0004280',
        ]),
        geneSymbols: JSON.stringify(['TBX5']),
        prevalence: '1/100,000',
      },
      {
        omimId: '607208',
        name: 'Dravet综合征',
        aliases: JSON.stringify([
          'Dravet syndrome',
          'DS',
          '婴儿严重肌阵挛癫痫',
          'SMEI',
          'Dravet',
        ]),
        description:
          'Dravet综合征（DS）是一种严重的发育性癫痫性脑病，由SCN1A基因功能丧失性突变引起，约80%为新生突变。临床特征为：1岁以内起病（常为热性惊厥），随病程发展出现多种癫痫发作类型（肌阵挛、失神、局灶性发作等），伴有进行性认知和运动功能退化。药物治疗效果有限，预后较差。',
        inheritance: JSON.stringify(['常染色体显性遗传（多数为新发突变）']),
        phenotypeIds: JSON.stringify([
          'HP:0001250',
          'HP:0001249',
          'HP:0001252',
          'HP:0002063',
          'HP:0000717',
          'HP:0001263',
          'HP:0001249',
          'HP:0004322',
        ]),
        geneSymbols: JSON.stringify(['SCN1A']),
        prevalence: '1/15,700 - 1/40,000',
      },
      {
        omimId: '192600',
        name: '肥厚型心肌病',
        aliases: JSON.stringify([
          'Hypertrophic cardiomyopathy',
          'HCM',
          '特发性肥厚型主动脉瓣下狭窄',
          'IHSS',
          '心肌肥厚',
        ]),
        description:
          '肥厚型心肌病（HCM）是最常见的遗传性心血管疾病，以左室壁非对称性肥厚为特征，发病率约1/500。约50-60%由肌节蛋白基因突变引起，其中MYH7和MYBPC3是最常见的致病基因。临床表现从无症状到严重心力衰竭、心律失常和猝死不等，是青年人（尤其是运动员）心源性猝死的主要原因之一。',
        inheritance: JSON.stringify(['常染色体显性遗传']),
        phenotypeIds: JSON.stringify([
          'HP:0001638',
          'HP:0001952',
          'HP:0004761',
          'HP:0004308',
          'HP:0001699',
          'HP:0001642',
        ]),
        geneSymbols: JSON.stringify(['MYH7', 'MYBPC3', 'TNNT2', 'TNNI3']),
        prevalence: '1/200 - 1/500',
      },
    ],
  })

  console.log(`✅ 已创建 ${diseases.count} 个疾病\n`)

  // ==================== 汇总 ====================
  console.log('═'.repeat(50))
  console.log('🎉 种子数据填充完成！')
  console.log('═'.repeat(50))
  console.log(`  📦 产品数量: ${products.count}`)
  console.log(`  🧬 HPO词条数量: ${hpoTerms.count}`)
  console.log(`  🧪 基因数量: ${genes.count}`)
  console.log(`  🏥 疾病数量: ${diseases.count}`)
  console.log('═'.repeat(50))
}

main()
  .catch((e) => {
    console.error('❌ 种子数据填充失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
