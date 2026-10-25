# GitHub Flavored Markdown 完整语法测试

这是一段普通文本，用来展示 **加粗**、*斜体*、~~删除线~~ 以及 `行内代码` 的效果。

---

## 1. 图片与链接
这里使用你提供的测试图片：
![测试图片](https://pic.nximg.cn/file/20230210/9629334_153223164103_2.jpg)

**链接测试：**
* [点击访问 GitHub](https://github.com)
* 自动链接测试：直接输入网址 https://github.com 应该也能被识别。

---

## 2. 列表支持

### 无序列表
- 苹果
- 香蕉
  - 嵌套的子项 1
  - 嵌套的子项 2
- 橘子

### 有序列表
1. 第一步：打开电脑
2. 第二步：写代码
   1. 写 HTML
   2. 写 CSS
3. 第三步：运行

### 任务列表 (Task List)
- [x] 已完成的任务
- [ ] 未完成的任务
- [ ] 还需要测试一下

---

## 3. 表格 (Tables)
GitHub 支持带对齐方式的表格：

| 左对齐 (默认) | 居中对齐 | 右对齐 | 包含代码 |
| :--- | :---: | ---: | :--- |
| 数据 A | `Code` | 100 | **加粗** |
| 数据 B | Text | 200 | *斜体* |
| 数据 C | Link | 300 | [链接](https://github.com) |

---

## 4. 代码块 (Code Blocks)
带语法高亮的代码块：

```javascript
function test() {
  console.log("Hello, Comrak!");
  return true;
}
```

```python
def hello():
    print("Hello from Python")

hello()
```

---

## 5. 引用 (Blockquotes)

> 这是一个普通的引用。
> 它可以有多行。

> 包含 **加粗** 和 [链接](https://github.com) 的引用。

---

## 6. HTML 折叠块 (Details / Summary)
*（注意：GitHub 规范要求在 `<summary>` 后，以及 `</details>` 前保留空行，内部的 Markdown 才会被正确解析）*

<details>
<summary>点击展开查看详细说明 👈</summary>

这里是隐藏的内容。它是完全支持 Markdown 语法的：
* 列表项
* [这是一个链接](https://github.com)
* 还有 `行内代码`

</details>

<details>
<summary>1.21.x</summary>

* [3.1.0-1.21.1](https://github.com/MoRanpcy/quickshulker/releases/download/3.1.0-1.21.1/quickshulker-3.1.0-1.21.1.jar)
* [3.1.0-1.21.2](https://github.com/MoRanpcy/quickshulker/releases/download/3.1.0-1.21.2/quickshulker-3.1.0-1.21.2.jar)
* [3.1.0-1.21.3](https://github.com/MoRanpcy/quickshulker/releases/download/3.1.0-1.21.3/quickshulker-3.1.0-1.21.3.jar)

</details>

---

## 7. GFM 警告提示块 (Alerts)
*（GitHub 独有的提示块语法，Comrak 也支持）*

> [!NOTE]
> 这是一个 Note 提示块。

> [!TIP]
> 这是一个 Tip 提示块。

> [!IMPORTANT]
> 这是一个 Important 提示块。

> [!WARNING]
> 这是一个 Warning 警告块。

> [!CAUTION]
> 这是一个 Caution 危险块。

---

## 8. 其他元素
分割线：
---
连续的三个破折号会在上方生成一条线。

Emoji 表情：
:rocket: :smile: :+1:
*（注：GitHub 支持将文字转化为原生 Emoji 显示）*