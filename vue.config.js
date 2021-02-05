// 引入雪碧生成工具
const SpritesmithPlugin = require('webpack-spritesmith')
// 引入打包分析工具
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin
const webpack = require('webpack')
// 引入stylelint 检测插件
const StylelintPlugin = require('stylelint-webpack-plugin')

const path = require('path')
const fs = require('fs')
const resolve = dir => path.join(__dirname, dir)
const IS_PROD = ['production', 'prod'].includes(process.env.NODE_ENV)
const IS_DEV = ['development', 'dev'].includes(process.env.NODE_ENV)

// 雪碧图定义
let has_sprite = true
let files = []
const icons = {}

try {
  fs.statSync(resolve('./src/assets/icons'))
  files = fs.readdirSync(resolve('./src/assets/icons'))
  files.forEach(item => {
    const filename = item.toLocaleLowerCase().replace(/_/g, '-')
    icons[filename] = true
  })
} catch (error) {
  fs.mkdirSync(resolve('./src/assets/icons'))
}

if (!files.length) {
  has_sprite = false
} else {
  try {
    let iconsObj = fs.readFileSync(resolve('./icons.json'), 'utf8')
    iconsObj = JSON.parse(iconsObj)
    has_sprite = files.some(item => {
      const filename = item.toLocaleLowerCase().replace(/_/g, '-')
      return !iconsObj[filename]
    })
    if (has_sprite) {
      fs.writeFileSync(resolve('./icons.json'), JSON.stringify(icons, null, 2))
    }
  } catch (error) {
    fs.writeFileSync(resolve('./icons.json'), JSON.stringify(icons, null, 2))
    has_sprite = true
  }
}

// 雪碧图样式处理模板
const SpritesmithTemplate = function(data) {
  // pc
  const icons = {}
  let tpl = `.ico {
  display: inline-block;
  background-image: url(${data.sprites[0].image});
  background-size: ${data.spritesheet.width}px ${data.spritesheet.height}px;
}`

  data.sprites.forEach(sprite => {
    const name = '' + sprite.name.toLocaleLowerCase().replace(/_/g, '-')
    icons[`${name}.png`] = true
    tpl = `${tpl}
.ico-${name}{
  width: ${sprite.width}px;
  height: ${sprite.height}px;
  background-position: ${sprite.offset_x}px ${sprite.offset_y}px;
}
`
  })
  return tpl
}

module.exports = {
  publicPath: IS_PROD ? process.env.VUE_APP_PUBLIC_PATH : './', // 默认'./'，部署应用包时的基本 URL
  outputDir: process.env.outputDir || 'dist', // 'dist', 生产环境构建文件的目录
  assetsDir: 'static', // 相对于outputDir的静态资源(js、css、img、fonts)目录
  lintOnSave: true,
  runtimeCompiler: true, // 是否使用包含运行时编译器的 Vue 构建版本
  productionSourceMap: !IS_PROD, // 生产环境的 source map
  parallel: require('os').cpus().length > 1,
  pwa: {},

  configureWebpack: config => {
    const plugins = []

    if (has_sprite) {
      // 生成雪碧图
      plugins.push(
        new SpritesmithPlugin({
          src: {
            cwd: path.resolve(__dirname, './src/assets/icons/'), // 图标根路径
            glob: '**/*.png' // 匹配任意 png 图标
          },
          target: {
            image: path.resolve(__dirname, './src/assets/images/sprites.png'), // 生成雪碧图目标路径与名称
            // 设置生成CSS背景及其定位的文件或方式
            css: [
              [
                path.resolve(__dirname, './src/assets/scss/sprites.scss'),
                {
                  format: 'function_based_template'
                }
              ]
            ]
          },
          customTemplates: {
            function_based_template: SpritesmithTemplate
          },
          apiOptions: {
            cssImageRef: '../images/sprites.png' // css文件中引用雪碧图的相对位置路径配置
          },
          spritesmithOptions: {
            padding: 2
          }
        })
      )
    }

    // 开启 stylelint 检测scss, css语法
    if (IS_DEV) {
      plugins.push(
        new StylelintPlugin({
          files: ['src/**/*.vue', 'src/assets/**/*.scss'],
          fix: true
        })
      )
      // 关闭host check，方便使用ngrok之类的内网转发工具
      config.devServer = {
        disableHostCheck: true
      }
    }

    config.plugins = [...config.plugins, ...plugins]
  },

  chainWebpack: config => {
    // 修复HMR
    config.resolve.symlinks(true)

    // 删除 moment 除 zh-cn 中文包外的其它语言包，无需在代码中手动引入 zh-cn 语言包。
    config
      .plugin('ignore')
      .use(
        new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /zh-cn$/)
      )

    // 添加别名
    config.resolve.alias
      .set('vue$', 'vue/dist/vue.esm.js')
      .set('@', resolve('src'))
      .set('api', resolve('src/apis'))
      .set('assets', resolve('src/assets'))
      .set('scss', resolve('src/assets/scss'))
      .set('components', resolve('src/components'))
      .set('plugins', resolve('src/plugins'))
      .set('router', resolve('src/router'))
      .set('store', resolve('src/store'))
      .set('utils', resolve('src/utils'))
      .set('views', resolve('src/views'))
      .set('layouts', resolve('src/layouts'))

    if (IS_PROD) {
      // 压缩图片
      config.module
        .rule('images')
        .test(/\.(png|jpe?g|gif|svg)(\?.*)?$/)
        .use('image-webpack-loader')
        .loader('image-webpack-loader')
        .options({
          mozjpeg: { progressive: true, quality: 65 },
          optipng: { enabled: false },
          pngquant: { quality: [0.65, 0.90], speed: 4 },
          gifsicle: { interlaced: false }
        })

      // 打包分析
      config.plugin('webpack-report').use(BundleAnalyzerPlugin, [
        {
          analyzerMode: 'static'
        }
      ])
    }

    // 使用svg组件
    const svgRule = config.module.rule('svg')
    svgRule.uses.clear()
    svgRule.exclude.add(/node_modules/)
    svgRule
      .test(/\.svg$/)
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({
        symbolId: 'icon-[name]'
      })

    const imagesRule = config.module.rule('images')
    imagesRule.exclude.add(resolve('src/icons'))
    config.module.rule('images').test(/\.(png|jpe?g|gif|svg)(\?.*)?$/)

    return config
  },

  devServer: {
    overlay: { // 让浏览器 overlay 同时显示警告和错误
      warnings: true,
      errors: true
    },
    open: true, // 是否打开浏览器
    host: 'localhost',
    port: '8080', // 代理断就
    https: false,
    hotOnly: true, // 热更新
    proxy: {
      '/api': {
        target: process.env.VUE_APP_BASE_API, // 目标代理接口地址
        secure: false,
        changeOrigin: false, // 开启代理，在本地创建一个虚拟服务端
        ws: false, // 是否启用websockets
        pathRewrite: {
          '^/api': '/'
        }
      }
    }
  }
}
