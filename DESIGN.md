---
name: PartyGame
description: 桌游俱乐部风格的手机聚会游戏；从当前实现提取的视觉系统
colors:
  pine: "#183e39"
  lime: "#cdee86"
  coral: "#f3a7a0"
  cool-white: "#f5f6f0"
  muted: "#526e65"
  line: "#d5ded4"
  outer: "#e8ede5"
  field: "#fafbf7"
  field-line: "#b6c6bd"
  soft: "#e8ece5"
  nav: "#e7ece2"
  status: "#e88f8666"
typography:
  display:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: "15.1cqw"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: "36px"
    fontWeight: 900
    lineHeight: 1.3
    letterSpacing: "-0.035em"
  title:
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.4
  secret-task:
    fontSize: "23px"
    fontWeight: 900
    lineHeight: 1.55
  task:
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.6
  body:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  field:
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontSize: "13px"
    fontWeight: 700
rounded:
  small: "12px"
  option: "16px"
  control: "20px"
  card: "24px"
  chip: "16px"
spacing:
  detail: "4px"
  related: "8px"
  compact: "12px"
  inset: "18px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.pine}"
    textColor: "{colors.cool-white}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.pine}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
  button-lime:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.pine}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
  button-soft:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.pine}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
  card-taboo:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.pine}"
    rounded: "{rounded.control}"
    padding: "18px"
  task-content:
    backgroundColor: "{colors.cool-white}"
    textColor: "{colors.pine}"
    rounded: "{rounded.option}"
    padding: "18px"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.pine}"
    typography: "{typography.field}"
    rounded: "{rounded.small}"
    padding: "13px 14px"
  status-tag:
    backgroundColor: "{colors.status}"
    textColor: "{colors.pine}"
    rounded: "{rounded.chip}"
    padding: "3px 12px"
  nav-active:
    backgroundColor: "{colors.pine}"
    textColor: "{colors.lime}"
    typography: "{typography.label}"
    padding: "10px"
---

# Design System: PartyGame

## Overview

**Creative North Star: "每人一手私牌，同桌一场好戏"**

沿用用户批准的「桌游俱乐部」：每部手机是一手私牌。松绿牌背与眼睛代表秘密任务，珊瑚牌与锁封代表隐藏禁忌，玩家以插画筹码入座。灯照桌面、纸牌、印章、拆开的封印与短促纸屑共同构成现场游戏感，界面先说明谁能看哪张牌，再让人回到线下互动。

丰富表现集中在入局、准备、发牌、投稿、解封和揭晓事件。任务正文位于稳定、平直的阅读面；真实 DOM 字体承担全部功能文案，插画承担物件和气氛。本文在已批准的视觉身份上合并当前实现，token 取自 `src/styles.css`，组件与行为取自 `src/components.jsx`、`src/screens.jsx`、`src/App.jsx`，字体取自 `src/main.jsx`。

**Key Characteristics:**

- 实体感私牌与玩家筹码表达归属和可见范围。
- 松绿稳定场景，青柠标记秘密与行动，珊瑚标记禁忌。
- 自托管中文字体、图标和任务文字保持清楚可读。
- 事件触发动效，阅读时静止，提供减少动态效果分支。
- 手机单列，桌面居中；保密规则优先于展示完整度。

## Colors

色彩以牌桌和纸牌为基底。规范值只维护在 frontmatter；CSS 自定义属性为主色来源，局部组件填色从当前规则提取。插画的自然明暗不自动成为新 token。sidecar 八阶色板是合成的面板预览，不是可直接替换产品颜色的应用色阶。

### Primary

- **松绿 / pine**：品牌、正文、主要按钮、牌背与导航选中底色。

### Secondary

- **青柠 / lime**：秘密任务、按住查看按钮、准备勾章与选中反馈。

### Tertiary

- **珊瑚 / coral**：隐藏禁忌、封印、分类块及解除前状态，不单独表示错误。

### Neutral

- **冷白 / cool-white**：应用页面、对话框与任务阅读面。
- **柔绿文字 / muted** 与 **浅绿边界 / line**：辅助文字和轻边界。
- **外侧灰绿 / outer**：桌面页面外侧；**field / field-line**：输入框与边线。
- **soft / nav**：次要按钮与导航底色；**status**：禁忌卡内的半透明状态标签填色。

**The Color-and-Symbol Rule.** 秘密任务同时使用名称与眼睛，隐藏禁忌同时使用名称与锁；状态另有文字或勾章，颜色不独立承担含义。

**The Opaque Reading Rule.** 插画上的标题、辅助标签和持续生效规则使用稳定实色底，任务正文使用冷白阅读面；不能借纹理或透明层降低文字清晰度。

## Typography

**Display Font / Body Font:** Noto Sans SC，回退 sans-serif。400、700、900 三个字重由 Fontsource 自托管，禁止合成字重。前端代码继承统一字体，图板中的失真字形不属于品牌。

**Character:** 粗重标题负责召集玩家，平直任务文字负责准确传达条件。frontmatter 记录实际角色，不把全部局部字号强制归入一套等比刻度。

### Hierarchy

- **Display**：入口两行短标题，按手机容器宽度缩放。
- **Headline**：常规页面标题；359px 及以下改为 31px。解除庆祝标题为 48px，属于该场景的强调。
- **Title**：模式与分组；秘密任务牌标题局部采用 27px / 700。
- **Secret-task**：本人秘密条件和动作；359px 及以下为 21px。
- **Task**：投稿预览和回顾任务；其他玩家禁忌同为 18px / 700，行高为 1.5。
- **Body**：页面说明；**field**：常规输入值；**label**：导航短标签。辅助说明依容器使用 12–14px，不承载关键条件。

**The Read-the-Whole-Card Rule.** 任务条件和执行动作自然换行并允许滚动，不能用裁切、单行省略或缩小关键字号迁就装饰。

## Layout

应用容器最大宽度为 442px，始终单列。600px 及以上页面增加上下 24px 外侧留白、容器圆角和阴影；入口最小高度 906px。默认内容页水平内边距 18px，359px 及以下为 14px；顶部和底部计入安全区。入口使用 442:906 的构图比例与容器查询字级，不能推广为其他页面固定屏高。

12 款头像选择为六列两行，默认按钮 55px、小屏 45px。大厅最多六人使用环桌位置，超过六人改三列可增高网格。长昵称、任务与回顾撑开内容，底部游戏导航保持 sticky。

浏览器已有 320、390、442、1280、1440 宽度截图。实体手机尚未验收；机械响应式比对的整桌面 / 手机区域对齐问题保持开放，不将其异常固化为布局规则。

## Elevation & Depth

深度来自栅格插画中的桌灯、纸边、封印和筹码，加上柔和 CSS 投影。阅读面依靠实色分层，输入和普通列表保持克制。组件阴影与动效的精确值集中在 sidecar。

### Shadow Vocabulary

- **card-lift**：秘密任务卡与提示条复用 CSS `--shadow`。
- **object-lift**：牌背采用柔和 drop-shadow，表现纸牌离桌。
- **navigation**：底部导航的浅投影。
- **dialog / desktop-shell**：对话框浮于遮罩之上，桌面容器与外侧背景分离。

**The Object-State Rule.** 位移、旋转和回弹用于牌、筹码与封印的状态变化；任务进入阅读状态后不持续晃动。

## Shapes

控件为圆润矩形，头像为圆形，牌卡保留纵向实体轮廓。小输入与文本标签、模式选项、按钮、主要卡片使用 frontmatter 中各自圆角，不沿用旧稿的通用胶囊按钮建议。秘密牌为栅格牌背加 DOM 阅读面，锁封可拆为两半；不要将栅格中的文字烘焙为功能文案。

## Components

### Buttons

主要按钮为松绿底冷白字，青柠变体用于明确的游戏行动；次要按钮透明底松绿边框，柔和变体采用浅绿填色。通用最小高度 56px，图标按钮 44px。入口按钮按构图放大。悬停轻微降低亮度，按下缩放 0.97，140ms 过渡；禁用态为 0.48 不透明度。全局焦点为 3px 松绿轮廓、4px 偏移，按钮另有冷白衬环。

### Cards / Containers

秘密任务默认呈牌背，按住或点按后挂载完整条件与动作。标题及持续规则有实色底，阅读区保持平直。本人禁忌卡猜中前只显示状态；其他玩家的禁忌带姓名、头像和完整条件。投稿预览上方有可见目标牌堆，成功后卡片缩入该位置。

### Player chips

12 个稳定 ID（0–11），原图集承载 0–5，独立 PNG 承载 6–11。头像在各页面复用；房主冠章与准备勾章分离，加入不等于准备。选中态用松绿边线、青柠填色和勾章，姓名不依赖插画辨识。

### Inputs / Fields

常驻标签，浅色平直输入面。常规字段最小高度 52px，多行文本最小高度 96px。焦点使用 2px 松绿轮廓与 2px 偏移。秘密投稿拆开条件与动作；禁忌明确由本人触发。房间码使用等宽数字排列与较宽字距。

### Navigation

顶部保持房间身份，收起与更多菜单分离。游戏导航为图标加文字，选中松绿 / 青柠，单项最小高度 72px；秘密模式无需他人禁忌入口。导航焦点环向内偏移，避免被圆角容器裁切。

### Confirmations and privacy

猜中确认展示对应玩家和条件；结束确认先说明所有任务将公开。原生 dialog 展示规则、邀请、成员和确认，二维码是邀请入口。服务端按玩家过滤数据，动画或遮罩不能替代权限。按住、点按与键盘查看均有代码处理；失焦与页面隐藏触发收起，但实体手机系统切后台尚未验收。

## Do's and Don'ts

### Do:

- **Do** 将任务名称、图标、颜色和可见范围放在一起。
- **Do** 让牌桌物件丰富，阅读区域保持稳定实色和完整文字。
- **Do** 在服务端成功后播放发牌、入池、解封与揭晓反馈。
- **Do** 为同一玩家复用头像 ID，并独立显示房主与准备状态。
- **Do** 保留按住与点按两种查看方式、可见焦点和明确的结束确认。

### Don't:

- **Don't** 用青柠或珊瑚在冷白底上写关键小字，或只靠颜色传达状态。
- **Don't** 让任务正文持续晃动、缩小、裁切或省略。
- **Don't** 将未授权信息预载后只靠牌背、模糊或动画遮挡。
- **Don't** 把加入当作准备、禁忌解除当作整局结束或洗牌动画当作分配成功。
- **Don't** 将静态 PDF、面板样例或浏览器截图当作实体手机与辅助技术验收。

未固化为规范：旧稿建议字体 / 胶囊按钮、位图中文字瑕疵、未对齐的机械响应式检测结果，以及超出已评分修正范围的视觉结论。重建后的两项修正已通过定向视觉复核，这不等于对所有表面的全面通过证明；实体手机、后台遮盖及减少动态效果的独立运行验收仍待完成。
