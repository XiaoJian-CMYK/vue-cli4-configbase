import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import 'normalize.css' // 引入初始化样式
import './plugins/element.js'
import '@/icons' // 引入svg 图标

Vue.config.productionTip = false

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
