# gulp-adui-component-shaking

adui 小程序端组件库用于组件 tree shaking 的 gulp 插件

## 安装

```shell
npm install gulp-adui-component-shaking
```

## 参数

- components，`Array<{srcPath, distPath}>`

srcPath: 组件库的组件所在的文件夹的绝对路径（必填）
disPath: 编译后组件库的组件所在的文件夹的绝对路径（必填）

## 使用注意事项

这个插件的作用原理是通过解析项目的 json 文件确定项目中组件的使用情况，然后在编译结束时将使用到的组件拷贝到 distPath 目录下，所以，在使用时有一些事项需要注意

- srcPath 和 disPath 必须是组件库下组件所在的文件夹路径，不是组件库所在的路径
- 开发模式下请监听 `json` 文件的变更，只有这样才能实时编译查看变化
- 因为这个插件需要遍历全部的 `json` 文件，所以在使用这个插件的任务中不要使用 change 或者是 newer 这类只监听部分文件的插件
- 使用这个插件时，将其所在的任务放在最后，避免因为删除文件夹带来一些问题
- 必须在任务结束时调用插件的 shaking 方法才会进行文件夹的拷贝，因为目前 gulp 还没有办法在插件里面监听到任务的结束

## 使用范例

```javascript
const path = require('path')
const { src, dest, series } = require('gulp')
const aduiComponentShaking = require('gulp-adui-component-shaking');

const componentConfig = [
  {
    srcPath: path.resolve(__dirname,'./src/adui-wxapp/lib/components/'),
    distPath: path.resolve(__dirname,'./dist/adui-wxapp/lib/components/'),
  }
]

function buildTs() {
  // 代码省略
}

function componentShaking() {
  return src('src/**/*.json')
  .pipe(aduiComponentShaking(componentConfig))
  .pipe(dest('dist'))
  .on('end', () => {
      aduiComponentShaking.shaking() // 结束时调用删除方法才会进行文件夹的删除
    })
},

exports.default = series(
  buildTs,
  componentShaking
)
```


