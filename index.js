const through = require('through2')
const path = require('path')
const fs = require('fs')
const fsExtra = require('fs-extra')

const commonUsed = ['common']

const getFileName = (filePath) => {
  const { name } = path.parse(filePath)
  return name
}

// 递归分析组件间的依赖关系
const relationParser = (relation, componentName, relationNew) => {
  const keys = Object.keys(relation)
  if (keys.includes(componentName)) {
    relationNew.push(...relation[componentName])
    relation[componentName].forEach((key) => {
      relationParser(relation, key, relationNew)
    })
  } else {
    return
  }
}

// 获取组件间的依赖关系
const getComponentRelation = (srcPath) => {
  const components = fs.readdirSync(srcPath)
  const componentRelation = {}
  components.forEach((item) => {
    // 排除公用的文件夹
    if (commonUsed.includes(item)) return
    const filePath = `${srcPath}/${item}/${item}.json`
    // 如果文件不存在，不读取文件，因为 Mac 上会存在一些隐藏的文件夹
    if(!fs.existsSync(filePath)) return
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    // 排除没有依赖关系的组件
    if (!fileData.usingComponents || Object.keys(fileData.usingComponents).length === 0) return
    // 获取引用的各个组件的key 值
    const componentKeys = Object.keys(fileData.usingComponents)
    // 获取被引用的各个组件的名字
    const componentsUsedCurrent = componentKeys.map((key) =>
      getFileName(fileData.usingComponents[key])
    )
    componentRelation[item] = [...componentsUsedCurrent]
  })
  const componentRelationNew = {}
  Object.keys(componentRelation).forEach((item) => {
    componentRelationNew[item] = [...componentRelation[item]]
    relationParser(componentRelation, item, componentRelationNew[item])
  })
  // 数据去重
  Object.keys(componentRelationNew).forEach((item) => {
    componentRelationNew[item] = Array.from(new Set(componentRelationNew[item]))
  })
  // console.log('pakizheng component', componentRelationNew)
  return componentRelationNew
}

let componentTransform = []

function componentsShaking(components) {
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
      componentRelation: getComponentRelation(srcPath),
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
          // 对于非组件库的 json 文件，对引用的组件进行路径分析，如果是组件库组件，提取组件的名字，否则不做处理
          if (!filePath.includes(item.srcPath)) {
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

componentsShaking.shaking = () => {
  // 编译结束之后对已经使用的组件，添加上关联的组件
  componentTransform.forEach((item) => {
    item.componentsUsed.forEach((itemUsed) => {
      if (Object.keys(item.componentRelation).includes(itemUsed)) {
        item.componentsUsed.push(...item.componentRelation[itemUsed])
      }
    })
    item.componentsUsed = Array.from(new Set(item.componentsUsed))
  })

  // 删除旧的组件库文件夹，拷贝用到的组件到组件库文件夹中
  componentTransform.forEach((item) => {
    if (fs.statSync(item.distPath)) {
      const componentsOldAll = fs.readdirSync(item.distPath)
      componentsOldAll.forEach((oldComponent) => {
        fs.rmdirSync(`${item.distPath}/${oldComponent}`, { recursive: true })
      })
    }
    item.componentsUsed.forEach((newComponent) => {
      fsExtra.copySync(`${item.srcPath}/${newComponent}`, `${item.distPath}/${newComponent}`)
    })
  })
}

module.exports = componentsShaking
