const through = require('through2')
const path = require('path')
const fs = require('fs')

const getFileName = (filePath) => {
  const { name } = path.parse(filePath)
  return name
}

let componentTransform = []

function componentsShaking(components) {
  const commonUsed = ['common']
  if (!components) {
    console.log('components 是必传参数，请检查对否有传入符合规定的参数')
    return through.obj({ defaultEncoding: 'utf8' }, function componentShaking(
      file,
      encoding,
      callback
    ) {
      this.push(file)
      callback()
    })
  }
  componentTransform = components.map(({ srcPath, distPath }) => {
    return {
      srcPath,
      distPath,
      componentRelation: {},
      componentsUsed: [...commonUsed],
    }
  })
  return through.obj({ defaultEncoding: 'utf8' }, function componentShaking(
    file,
    encoding,
    callback
  ) {
    // 只处理 json 文件
    if (file.relative.includes('.json')) {
      // 获取文件的绝对地址
      const filePath = path.resolve(file.base, file.relative)
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      // 如果文件里面含有 usingComponents 才进行处理
      if (fileData.usingComponents) {
        componentTransform.forEach((item) => {
          // 如果路径包含组件库的绝对路径，说明此时的 json 文件是组件库的 json 文件，进行组件库中文件的引用关联处理
          if (filePath.includes(item.srcPath)) {
            // 获取当前文件的信息
            const componentName = getFileName(filePath)
            // 获取引用的各个组件的key 值
            const componentKeys = Object.keys(fileData.usingComponents)
            if (componentKeys.length === 0) return
            // 获取被引用的各个组件的名字
            const componentsUsedCurrent = componentKeys.map((key) =>
              getFileName(fileData.usingComponents[key])
            )
            item.componentRelation[componentName] = [...componentsUsedCurrent]
          } else {
            // 对于非组件库的 json 文件，对引用的组件进行路径分析，如果是组件库组件，提取组件的名字，否则不做处理
            const componentKeys = Object.keys(fileData.usingComponents)
            const { dir } = path.parse(filePath)
            componentKeys.forEach((key) => {
              const componentCurrentPath = path.resolve(
                dir,
                fileData.usingComponents[key]
              )
              const { name } = path.parse(componentCurrentPath)
              if (componentCurrentPath.includes(item.srcPath)) {
                item.componentsUsed.push(name)
              }
            })
          }
        })
      }
    }
    // 确保文件能够正常入流和出流
    this.push(file)
    callback()
  })
}

componentsShaking.delete = () => {
  // 编译结束之后对已经使用的组件，添加上关联的组件
  componentTransform.forEach((item) => {
    item.componentsUsed.forEach((itemUsed) => {
      if (Object.keys(item.componentRelation).includes(itemUsed)) {
        item.componentsUsed.push(...item.componentRelation[itemUsed])
      }
    })
    item.componentsUsed = Array.from(new Set(item.componentsUsed))
  })
  // 删除多余的文件夹
  componentTransform.forEach((item) => {
    const componentsAll = fs.readdirSync(item.distPath)
    const componentUnUsed = []
    componentsAll.forEach((i) => {
      if (!item.componentsUsed.includes(i)) {
        componentUnUsed.push(`${item.distPath}/${i}`)
      }
    })
    componentUnUsed.forEach((itemUnUsed) => {
      if (fs.statSync(itemUnUsed)) {
        fs.rmdirSync(itemUnUsed, { recursive: true })
      }
    })
  })
}

module.exports = componentsShaking
