// ==UserScript==
// @name         贝壳采集器-饿了么
// @namespace    https://h5.ele.me
// @version      0.2
// @updateURL    https://github.com/uidkolo/eleme/blob/master/eleme.js
// @description  采集商家数据
// @author       Huyang
// @match        https://h5.ele.me/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  const eleme = {
    // 初始化
    init: function () {
      this.addDom()
      this.recoverData()
      this.addListener()
    },
    // 所有地区的经纬度
    locations: {
      "新罗": {
        latitude: '25.075884',
        longitude: '117.017362'
      },
      "漳平": {
        latitude: '25.290481',
        longitude: '117.419823'
      },
      "永定": {
        latitude: '24.724148',
        longitude: '116.732216'
      },
      "连城": {
        latitude: '25.710538',
        longitude: '116.754472'
      },
      "武平": {
        latitude: '25.096139',
        longitude: '116.100216'
      },
      "长汀": {
        latitude: '25.833531',
        longitude: '116.357581'
      },
      "上杭": {
        latitude: '25.096139',
        longitude: '116.100216'
      }
    },
    // 让页面滚动到底部，自动弹出人机验证窗口
    scrollToBottom: function () {
      const height = document.body.scrollHeight
      window.scroll(0, height)
    },
    // 刷新后恢复页面数据
    recoverData: function () {
      // 选中地区
      document.getElementById('youhou_select').value = GM_getValue('checkedLocation') == undefined ? '新罗' : GM_getValue('checkedLocation')
      // 完成数量
      if(GM_getValue('completeCount') == undefined){
        GM_setValue('completeCount', 0)
      }
      document.getElementById('complete_count').innerHTML = GM_getValue('completeCount') == undefined ? 0 : GM_getValue('completeCount')
      // 跳过数量
      const offset = GM_getValue('offset') == undefined ? 0 : GM_getValue('offset')
      document.getElementById('youhou_offset').value = GM_getValue('offset') == undefined ? GM_getValue('completeCount') : offset
      // 是否有新数据
      document.getElementById('has_next').innerHTML = GM_getValue('hasNext') == undefined ? '是' : GM_getValue('hasNext')
      // 服务器地址
      document.getElementById('youhou_server_url').value = GM_getValue('serverUrl') == undefined ? '' : GM_getValue('serverUrl')
      //店铺列表
      this.applyDom(GM_getValue('shops'))
    },
    // 获取缓存列表里未采集的第一条数据
    getFirstData: function () {
      const shops = GM_getValue('shops')
      let meetData = null
      let i = 0
      while (i < shops.length) {
        const { aptitude, shopInfo, commodityList, evaluateList } = shops[i]
        if (aptitude != 3 && shopInfo != 3 && commodityList != 3 && evaluateList != 3) {
          meetData = shops[i]
          i = shops.length
        } else {
          i++
        }
      }
      return meetData
    },
    // 添加事件监听
    addListener: function () {
      const _this = this
      // 地区选择
      document.getElementById('youhou_select').onchange = function () {
        GM_setValue('checkedLocation', this.value)
      }
      // 监听已采集总数变化 跳过数量 = 已采集总数
      GM_addValueChangeListener('completeCount', function (name, old_value, new_value, remote) {
        document.getElementById('complete_count').innerHTML = new_value
        if (new_value > 0) { //屏蔽重置数据情况
          let offset = GM_getValue('offset') == undefined ? 0 : GM_getValue('offset')
          GM_setValue('offset', offset + (new_value - old_value))
          document.getElementById('youhou_offset').value = offset + (new_value - old_value)
        }
      })
      // 监听是否还有新数据
      GM_addValueChangeListener('hasNext', function (name, old_value, new_value, remote) {
        document.getElementById('has_next').innerHTML = new_value
      })
      // 修改跳过数量
      document.getElementById('youhou_offset').onchange = function () {
        GM_setValue('offset', parseInt(this.value))
      }
      // 点击重置按钮
      document.getElementById('youhou_reset').onclick = function () {
        GM_setValue('offset', 0)
        GM_setValue('completeCount', 0)
        GM_setValue('checkedLocation', '新罗')
        GM_setValue('serverUrl', '')
        GM_setValue('shops', [])
        GM_setValue('working', false)
        _this.recoverData()
      }
      // 点击获取店铺
      document.getElementById('youhou_get_shop').onclick = async () => {
        const { code, message, data } = await _this.getShopLinks()
        console.log(message)
        const { hasNext, shops } = data
        if (code == 200) {
          GM_setValue('shops', shops)
          GM_setValue('hasNext', hasNext ? '是' : '否')
        } else if (code == 504) {
          GM_setValue('shops', [])
          confirm(message)
          location.href = 'https://tb.ele.me/wow/msite/act/login'
        } else {
          _this.scrollToBottom()
        }
      }
      // 监听采集店铺列表
      GM_addValueChangeListener('shops', function (keyName, old_value, new_value, remote) {
        _this.applyDom(new_value)
      })

      // 监听修改服务器地址
      document.getElementById('youhou_server_url').onchange = function () {
        GM_setValue('serverUrl', this.value)
      }

      // 点击开始采集
      document.getElementById('youhou_begin').onclick = function () {
        GM_setValue('working', false)
        GM_setValue('working', true)
      }

      // 监听是否正在采集
      GM_addValueChangeListener('working', function (keyName, old_value, new_value, remote) {
        if (new_value) {
          // 开始采集下一个
          const shop = _this.getFirstData()
          if (!shop) {
            alert('请先获取店铺数据')
          } else {
            GM_setValue('curShop', shop)
            GM_setValue('postData', null)
            window.open(shop.link, '', 'width=400,height=400,left=10,top=100')
          }
        }
      })

    },
    // 店铺数据渲染至页面
    applyDom: function (shops) {
      for (let index = 0; index < 20; index++) {
        document.getElementById(`youhou_td_id_${index}`).innerHTML = ''
        document.getElementById(`youhou_td_name_${index}`).innerHTML = ''
        document.getElementById(`youhou_td_info_status_${index}`).innerHTML = ''
        document.getElementById(`youhou_td_commodity_status_${index}`).innerHTML = ''
        document.getElementById(`youhou_td_evaluate_status_${index}`).innerHTML = ''
        document.getElementById(`youhou_td_aptitude_status_${index}`).innerHTML = ''
      }
      if (shops && shops.length > 0) {
        shops.map((item, index) => {
          function mapText(code) {
            let html = ''
            switch (code) {
              case 0:
                html = "<span>待采集</span>"
                break
              case 1:
                html = "<span style='color: #0085ff'>采集中</span>"
                break
              case 2:
                html = "<span style='color: #ffb515'>上传中</span>"
                break
              case 3:
                html = "<span style='color: green'>已完成</span>"
                break
              case -1:
                html = "<span style='color: red'>出错了</span>"
                break
            }
            return html
          }
          let { id, name, aptitude, shopInfo, commodityList, evaluateList } = item
          document.getElementById(`youhou_td_id_${index}`).innerHTML = id
          document.getElementById(`youhou_td_name_${index}`).innerHTML = name
          document.getElementById(`youhou_td_info_status_${index}`).innerHTML = mapText(shopInfo)
          document.getElementById(`youhou_td_commodity_status_${index}`).innerHTML = mapText(commodityList)
          document.getElementById(`youhou_td_evaluate_status_${index}`).innerHTML = mapText(evaluateList)
          document.getElementById(`youhou_td_aptitude_status_${index}`).innerHTML = mapText(aptitude)
        })
      }
    },
    // createElement
    createDom: function (tag, id, style, parent, content) {
      let dom = document.createElement(tag)
      dom.id = id
      dom.style = style
      if (content) { dom.innerHTML = content }
      parent.appendChild(dom)
      return dom
    },
    // 向页面添加dom
    addDom: function () {
      // 容器
      let container = this.createDom('div', 'youhou_container', `
          position: fixed;
          z-index: 99999;
          width: 100%;
          height: 100%;
          left: 0;
          top: 0;
          background: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
        `, document.body)

      let box = this.createDom('div', 'youhou_box', `
          width: 600px;
          height: 100%;
          padding-top: 120px;
          padding-bottom: 60px;
          box-shadow: 0 0 10px 10px rgba(0,0,0,0.2);
          overflow-y: auto;
        `, container)

      // 标题
      let title = this.createDom('div', 'youhou_title', `
          height: 60px;
          width: 600px;
          position: fixed;
          z-index: 2;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(90deg,#0af,#0085ff);
          font-size: 24px;
          color: #fff;
          font-weight: border;
          line-height: 60px;
          text-align: center;
        `, box, "贝壳采集V1.0 -- 作者（HUYANG）")

      //底部操作栏
      let navbar = this.createDom('div', 'youhou_navbar', `
          height: 50px;
          width: 600px;
          position: fixed;
          z-index: 2;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          box-shadow: 0 -1px 10px 0 rgba(0,0,0,0.2);
          border-top: 1px solid #ebebeb;
          display: flex;
          align-items: center;
          justify-content: :space-between;
        `, box)

      // 服务器地址输入框
      let serverUrlInput = this.createDom('input', 'youhou_server_url', `
          flex-grow: 1;
          height: 100%;
          font-size: 16px;
          border: 1px solid #0085ff;
          padding: 0 10px;
        `, navbar)
      serverUrlInput.setAttribute('placeholder', '请填入接收数据的服务器地址')

      //开始采集按钮
      let beginBtn = this.createDom('button', 'youhou_begin', `
          width: 30%;
          height: 100%;
          font-size: 16px;
          background: #0085ff;
          color: #fff;
          cursor: pointer;
        `, navbar, '开始采集')

      // 设置
      let set = this.createDom('div', 'youhou_set', `
          height: 60px;
          width: 600px;
          position: fixed;
          background: #fff;
          top: 60px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #ebebeb;
        `, box)

      // 选择地区
      let select = this.createDom('select', 'youhou_select', `
          height: 40px;
          width: 80px;
          border: 1px solid #ebebeb;
          font-size: 16px;
          -webkit-appearance: menulist-button;
          padding: 0 10px;
          margin-right: 10px;
        `, set)

      const areas = Object.keys(this.locations)
      areas.map(area => {
        this.createDom('option', 'youhou_option', ``, select, area)
      })

      // 输入跳过数量
      let span = this.createDom('span', 'youhou_offset_label', `
          font-size: 16px;
        `, set, '跳过数量：')
      let offset = this.createDom('input', 'youhou_offset', `
          width: 60px;
          padding: 0 10px;
          height: 40px;
          border: 1px solid #ebebeb;
          font-size: 16px;
          input::-webkit-input-placeholder: #f5f5f5;
        `, set)

      // 已完成总数
      let completeCount = this.createDom('div', 'youhou_complete', `
          font-size: 16px;
          margin: 0 20px;
          display: flex;
          flex-direction: column;
        `, set, `<div>当前已采集<span id="complete_count" style="color:red;font-weight:bold;margin:0 5px;">0</span>条<div><s'pan>是否还有新数据:<span id="has_next" style="color:red;font-weight:bold;">是</span></div>`)

      // 重置按钮
      let resetBtn = this.createDom('button', 'youhou_reset', `
          width: 80px;
          height: 40px;
          font-size: 16px;
          border: 1px solid #ebebeb;
          cursor: pointer;
          border-radius: 4px;
          margin-right: 10px;
        `, set, '重置数据')

      // 获取店铺按钮
      let getShopBtn = this.createDom('button', 'youhou_get_shop', `
          width: 80px;
          height: 40px;
          font-size: 16px;
          background: #0085ff;
          color: #fff;
          cursor: pointer;
          border-radius: 4px;
        `, set, '获取店铺')

      // 表格
      let table = this.createDom('div', 'youhou_table', `
          display: flex;
          flex-direction: column;
          align-items: center;
        `, box)

      // th
      let th = this.createDom('div', 'youhou_th', `
          display: flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          width: 100%;
          border-bottom: 1px solid #ebebeb;
          line-height: 40px;
          font-weight: bold;
        `, table)
      this.createDom('div', 'youhou_td_id', `
          text-align: center;
          font-size: 14px;
          color: #666;
          width: 80px;
          border-right: 1px solid #ebebeb;
          height: 40px;
        `, th, 'ID')
      this.createDom('div', 'youhou_td_name', `
          text-align: center;
          font-size: 12px;
          color: #666;
          flex-grow: 1;
          border-right: 1px solid #ebebeb;
          height: 40px;
        `, th, '商家名称')
      this.createDom('div', 'youhou_td_commodity_status', `
          text-align: center;
          font-size: 14px;
          color: #666;
          width: 70px;
          border-right: 1px solid #ebebeb;
          height: 40px;
        `, th, '商品列表')
      this.createDom('div', 'youhou_td_info_status', `
        text-align: center;
        font-size: 14px;
        color: #666;
        width: 70px;
        border-right: 1px solid #ebebeb;
        height: 40px;
      `, th, '店铺信息')
      this.createDom('div', 'youhou_td_evaluate_status', `
          text-align: center;
          font-size: 14px;
          color: #666;
          width: 70px;
          border-right: 1px solid #ebebeb;
          height: 40px;
        `, th, '评价列表')
      this.createDom('div', 'youhou_td_aptitude_status', `
          text-align: center;
          font-size: 14px;
          color: #666;
          width: 70px;
          height: 40px;
        `, th, '资质信息')

      // tr
      for (let i = 0; i < 20; i++) {
        let tr = this.createDom('div', `youhou_tr_${i}`, `
          display: flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          width: 100%;
          line-height: 40px;
          border-bottom: 1px solid #ebebeb;
        `, table)
        this.createDom('div', `youhou_td_id_${i}`, `
          text-align: left;
          padding-left: 5px;
          font-size: 12px;
          color: #666;
          width: 80px;
          border-right: 1px solid #ebebeb;
          height: 40px;
          font-size: 12px;
          flex-shrink: 0;
        `, tr)
        this.createDom('div', `youhou_td_name_${i}`, `
          color: #666;
          flex-grow: 1;
          border-right: 1px solid #ebebeb;
          height: 40px;
          line-height: 1;
          padding: 0 5px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
        `, tr)
        this.createDom('div', `youhou_td_commodity_status_${i}`, `
          text-align: center;
          color: #666;
          width: 70px;
          border-right: 1px solid #ebebeb;
          height: 40px;
          flex-shrink: 0;
        `, tr)
        this.createDom('div', `youhou_td_info_status_${i}`, `
          text-align: center;
          color: #666;
          width: 70px;
          border-right: 1px solid #ebebeb;
          height: 40px;
          flex-shrink: 0;
        `, tr)
        this.createDom('div', `youhou_td_evaluate_status_${i}`, `
          text-align: center;
          color: #666;
          width: 70px;
          border-right: 1px solid #ebebeb;
          height: 40px;
          flex-shrink: 0;
        `, tr)
        this.createDom('div', `youhou_td_aptitude_status_${i}`, `
          text-align: center;
          color: #666;
          width: 70px;
          height: 40px;
          flex-shrink: 0;
        `, tr)
      }
    },
    // 数字映射表
    mapDigit: function (text) {
      const digitMap = {
        '': '0',
        '릶': '1',
        '빟': '2',
        '버': '3',
        '': '4',
        '첣': '5',
        '묩': '6',
        '': '7',
        '': '8',
        '끁': '9',
        '': '.',
        '': '-'
      }
      let mapValue = ''
      if (text) {
        for (let i = 0; i < text.length; i++) {
          if (Object.keys(digitMap).includes(text.charAt(i))) {
            mapValue += digitMap[text.charAt(i)]
          } else {
            mapValue += text.charAt(i)
          }
        }
      }
      return mapValue
    },
    // 获取店铺链接
    getShopLinks: function () {
      const _this = this
      return new Promise((resolve, reject) => {
        const limit = 20
        const offset = GM_getValue('offset') ? GM_getValue('offset') : 0
        const checkedLocation = GM_getValue('checkedLocation') == 'undefined' ? '新罗' : GM_getValue('checkedLocation')
        const { latitude, longitude } = _this.locations[checkedLocation]
        GM_xmlhttpRequest({
          method: "GET",
          url: `https://h5.ele.me/restapi/shopping/v3/restaurants?latitude=${latitude}&longitude=${longitude}&offset=${offset}&limit=${limit}&extras[]=activities&extras[]=tags&extra_filters=home&order_by=5&terminal=h5`,
          onload: function (response) {
            const res = JSON.parse(response.response)
            if (res.items) {
              let data = []
              res.items.map(item => {
                data.push({
                  id: item.restaurant.authentic_id,
                  name: item.restaurant.name,
                  link: item.restaurant.scheme,
                  aptitude: 0,
                  shopInfo: 0,
                  commodityList: 0,
                  evaluateList: 0
                })
              })
              resolve({
                code: 200,
                message: 'success',
                data: {
                  hasNext: res.has_next,
                  shops: data
                }
              })
            } else {
              if (res.message) {
                resolve({
                  code: 504,
                  message: '请登录',
                  data: {
                    hasNext: true,
                    shops: []
                  }
                })
              } else {
                resolve({
                  code: 500,
                  message: '请进行人机验证',
                  data: {
                    hasNext: true,
                    shops: []
                  }
                })
              }
            }
          }
        })
      })
    },
    // 延时函数
    delay: async function (time) {
      return new Promise((resolve, reject) => {
        setTimeout(function () {
          resolve()
        }, time)
      })
    },
    // 获取店铺信息
    // shop_id    店铺ID
    // name    店铺名称
    // logo    商家logo地址
    // grade    商家评价（评分）
    // sales    月销量
    // classify    商家分类
    // address    商家地址
    // phone    商家电话  暂时无法拿到
    // open_hours    营业时间
    // make_invoice    是否提供发票 缺
    getShopInfo: async function (type) {
      try {
        const shop_id = GM_getValue('curShop')['id']
        let info = {
          shop_id,
          name: '',
          logo: '',
          grade: '',
          sales: '',
          classify: '',
          address: '',
          phone: '',
          address: '',
          open_hours: ''
        }
        if (type == 1) { //旧店铺页面
          info.name = document.getElementsByClassName('index-UYhnL')[0].textContent
          info.logo = document.getElementsByClassName('index-3eDRn')[0].getAttribute('src')

          const gradeText = document.getElementsByClassName('index-24KTi')[0].children[0].textContent.split('评价')[1]
          info.grade = this.mapDigit(gradeText)

          const salesText = document.getElementsByClassName('index-24KTi')[0].textContent.split('月售')[1].split('单')[0]
          info.sales = this.mapDigit(salesText)

          info.classify = document.getElementsByClassName('detail-3mz9N')[0].children[1].children[1].textContent

          const addressText = document.getElementsByClassName('detail-3mz9N')[0].children[3].children[1].textContent
          info.address = this.mapDigit(addressText)

          // const phoneText = document.getElementsByClassName('detail-3mz9N')[0].children[2].children[1].textContent
          info.open_hours = document.getElementsByClassName('detail-3mz9N')[0].children[4].children[1].textContent
        }
        if (type == 2) { //新店铺页面
          info.name = document.getElementById('name-wrapper').getElementsByClassName('name')[0].textContent
          info.logo = document.getElementsByClassName('shop-logo')[0].getAttribute('src')
          info.grade = document.getElementsByClassName('extra-tag')[0].textContent
          info.sales = document.getElementsByClassName('tag-text')[0].textContent.split('月售').pop()

          //切换商家tab
          this.getNewShopTab(2).click()
          await this.delay(200)

          info.classify = document.getElementsByClassName('shop-basic-info-item')[0].textContent.split(': ').pop()
          info.address = document.getElementsByClassName('shop-address')[0].textContent
          info.phone = document.getElementsByClassName('top-right')[0].getElementsByTagName('a')[0].getAttribute('href').split(':').pop()
          info.open_hours = document.getElementsByClassName('shop-basic-info-item')[1].textContent.split(': ').pop()
        }
        return info
      } catch (err) {
        console.log(err)
        return null
      }

    },
    // 获取商品列表
    // shop_id    店铺ID
    // name    商品名称
    // image    商品首图
    // sales    商品销量
    // price    商品价格
    getCommodityList: async function (type) {
      try {
        let commodityList = []
        const shop_id = GM_getValue('curShop')['id']
        if (type == 1) { //旧店铺页面
          await this.delay(1000)
          const scroller = document.getElementsByClassName('scroller')[0]
          scroller.style.height = 'auto'
          const height = document.body.scrollHeight
          window.scroll({ top: height, left: 0, behavior: 'smooth' })
          await this.delay(2000)// 延迟2s保证延时加载的数据加载完成
          const doms = document.getElementsByClassName('fooddetails-root_2HoY2')
          for (let i = 0; i < doms.length; i++) {
            const item = doms[i]
            const name = item.getElementsByClassName('fooddetails-nameText_250s_')[0].textContent
            let image = ''
            const imageBoxDom = item.getElementsByClassName('fooddetails-logo_2Q0S7')
            if (imageBoxDom.length > 0) {
              image = imageBoxDom[0].getElementsByTagName('img')[0].getAttribute('src')
            }
            const salesText = item.getElementsByClassName('fooddetails-sales_1ETVq')[0].children[0].textContent.split('月售')[1].split('份')[0]
            const sales = this.mapDigit(salesText)
            const priceText = item.getElementsByClassName('salesInfo-price_3_oc1_0 fooddetails-salesInfo_MPG41')[0].children[0].textContent
            const price = this.mapDigit(priceText)
            commodityList.push({
              shop_id,
              name,
              image,
              sales,
              price
            })
          }
        }
        if (type == 2) { //新店铺页面
          this.getNewShopTab(0).click()
          await this.delay(1000)
          const height = document.body.scrollHeight
          window.scroll({ top: height, left: 0, behavior: 'smooth' })
          await this.delay(2000)// 延迟2s保证延时加载的数据加载完成
          const doms = document.getElementsByClassName('normal-fooddetail-container')
          for (let i = 0; i < doms.length; i++) {
            const item = doms[i]
            const name = item.getElementsByClassName('name')[0].textContent
            const image = item.getElementsByClassName('img')[0].style.backgroundImage.split('"')[1]
            const sales = item.getElementsByClassName('month-sale')[0].textContent.split('月售').pop()
            const price = item.getElementsByClassName('current-price')[0].textContent.split('￥').pop()
            commodityList.push({
              shop_id,
              name,
              image,
              sales,
              price
            })
          }
        }
        return commodityList
      } catch (err) {
        console.log(err)
        return null
      }
    },
    // 获取评价列表
    // shop_id    商品ID
    // name    会员昵称
    // date    评价日期
    // grade    评价星级  新零售非星级
    // content    评价内容
    // images    评级图片
    getEvaluateList: async function (type) {
      try {
        const shop_id = GM_getValue('curShop')['id']
        let evaluateList = []
        if (type == 1) { //旧店铺页面
          const tab = document.getElementsByClassName('shop-tab-2ipt1')[1]
          tab.click()
          await this.delay(500) // 延迟1s保证dom渲染完成
          const height = document.body.scrollHeight
          window.scroll({ top: height, left: 0, behavior: 'smooth' })
          await this.delay(2000)// 延时2s确保数据加载
          const doms = document.getElementsByClassName('index-RD5RX')
          for (let i = 0; i < doms.length; i++) {
            const item = doms[i]
            const name = item.getElementsByClassName('comment-block-2u8__')[0].textContent
            const dateText = item.getElementsByClassName('comment-block-2lqfX')[0].textContent
            const date = this.mapDigit(dateText)

            // 兼容只有图片的情况
            const contentBox = item.getElementsByClassName('comment-block-af0_9')
            let content = ''
            if (contentBox.length) {
              content = contentBox[0].textContent
            }

            const imgBoxDom = item.getElementsByClassName('comment-block-3NNJa')
            let images = ''
            if (imgBoxDom.length > 0) {
              const imgs = imgBoxDom[0].getElementsByTagName('img')
              const imgArr = []
              for (let i = 0; i < imgs.length; i++) {
                imgArr.push(imgs[i].getAttribute('src'))
              }
              images = imgArr.join(',')
            }
            evaluateList.push({
              shop_id,
              name,
              date,
              content,
              images
            })
          }
        }
        if (type == 2) { //新店铺页面
          //切换商家tab
          this.getNewShopTab(1).click()
          await this.delay(500)
          const height = document.body.scrollHeight
          window.scroll({ top: height, left: 0, behavior: 'smooth' })
          await this.delay(2000)// 延时2s确保数据加载
          const doms = document.getElementsByClassName('comment_S8vOq')
          for (let i = 0; i < doms.length; i++) {
            const item = doms[i]
            const name = item.getElementsByClassName('username_14ZYK')[0].textContent
            const date = item.getElementsByClassName('time_38_z7')[0].textContent

            // 兼容只有图片的情况
            let content = ''
            if (item.getElementsByClassName('content_XlCNd')[0].getElementsByClassName('text_3rNt7').length > 0) {
              content = item.getElementsByClassName('content_XlCNd')[0].getElementsByClassName('text_3rNt7')[0].textContent
            }

            const imgBoxDom = item.getElementsByClassName('photos_3el3U')
            let images = ''
            if (imgBoxDom.length > 0) {
              const imgs = imgBoxDom[0].getElementsByTagName('img')
              const imgArr = []
              for (let i = 0; i < imgs.length; i++) {
                imgArr.push(imgs[i].getAttribute('src'))
              }
              images = imgArr.join(',')
            }
            evaluateList.push({
              shop_id,
              name,
              date,
              content,
              images
            })
          }
        }
        return evaluateList
      } catch (err) {
        console.log(err)
        return null
      }
    },
    // 获取商家资质
    // shop_id    店铺ID
    // name  单位名称
    // inspect_result    检查结果
    // address    经营地址
    // legal_person    法人
    // license_key    许可证号
    // business_scope    经营范围
    // validity_date    有效期
    // permit_image    营业执照图片
    // license_image    许可证图片
    getAptitude: async function (type) {
      try {
        let aptitude = {
          shop_id: GM_getValue('curShop')['id'],
          name: '',
          inspect_result: '',
          address: '',
          legal_person: '',
          license_key: '',
          business_scope: '',
          validity_date: '',
          permit_image: '',
          license_image: ''
        }
        if (type == 1) { //旧店铺页面
          // 判断是否有单位信息栏
          let infoDom = document.getElementsByClassName('index-1Jh-Y index-2CjvZ')
          if (infoDom.length > 0) {
            infoDom = infoDom[0]
            aptitude.name = infoDom.getElementsByClassName('index-1zRUn')[0].children[1].textContent
            aptitude.inspect_result = infoDom.getElementsByClassName('index-2cFpR')[0].children[0].textContent
            aptitude.address = infoDom.getElementsByClassName('index-1zRUn')[1].children[1].textContent
            aptitude.legal_person = infoDom.getElementsByClassName('index-1zRUn')[2].children[1].textContent
            aptitude.license_key = infoDom.getElementsByClassName('index-1zRUn')[3].children[1].textContent
            aptitude.business_scope = infoDom.getElementsByClassName('index-1zRUn')[4].children[1].textContent
            aptitude.validity_date = infoDom.getElementsByClassName('index-1zRUn')[5].children[1].textContent
          }
          // 执照图片
          let imgDom = document.getElementsByClassName('qualification-UupwC index-2CjvZ')
          if (imgDom.length > 0) {
            imgDom = imgDom[0]
            aptitude.permit_image = imgDom.getElementsByTagName('img')[0].getAttribute('src')
            aptitude.license_image = imgDom.getElementsByTagName('img')[1].getAttribute('src')
          }
        }
        if (type == 2) { //新店铺页面
          // 执照图片
          let imgDom = document.getElementsByClassName('imgItem_1iQur')
          if (imgDom.length > 0) {
            aptitude.permit_image = imgDom[0].getElementsByTagName('img')[0].getAttribute('src')
            aptitude.license_image = imgDom[1].getElementsByTagName('img')[0].getAttribute('src')
          }
        }

        if (aptitude.permit_image == '' || aptitude.license_image == '') {
          return null
        }
        return aptitude
      } catch (err) {
        console.log(err)
        return null
      }
    },
    // 通过店铺名称获取ID
    getShopIdByName: function (name) {
      const shops = GM_getValue('shops')
      let id = ''
      shops.map(item => {
        if (item.name == name) {
          id = item.id
        }
      })
      return id
    },
    // 通过id更新shops采集状态
    updateShopsById: function (id, value, key) {
      const shops = GM_getValue('shops')
      shops.map(item => {
        if (item.id == id) {
          if (key) {
            item[key] = value
          } else {
            item['commodityList'] = value
            item['shopInfo'] = value
            item['aptitude'] = value
            item['evaluateList'] = value
          }
        }
      })
      GM_setValue('shops', shops)
    },
    // 数据发送到服务器
    postDataToServer: function (data) {
      return new Promise((resolve, reject) => {
        const url = GM_getValue('serverUrl')
        GM_xmlhttpRequest({
          method: "POST",
          url: url,
          data: JSON.stringify(data),
          headers: { "Content-Type": "application/json" },
          onload: function (res) {
            const data = JSON.parse(res.response)
            if (data && data.result) {
              resolve(true)
            } else {
              resolve(false)
            }
          }
        })
      })
    },
    // 新版店铺兼容多个菜单
    getNewShopTab: function (index) {
      const tabs = document.getElementsByClassName('tab-wrapper')
      if (tabs.length == 4) {
        index = index + 1
      }
      return tabs[index]
    },
    // 采集店铺详情页数据
    getDetailInfo: async function (type) {
      await this.delay(1000) // 延迟1s保证dom渲染完成
      const shop_id = GM_getValue('curShop')['id']
      this.updateShopsById(shop_id, 1)// 设置状态=>采集中
      const commodityList = await this.getCommodityList(type) // 1.获取商品列表
      if (commodityList) {
        const shopInfo = await this.getShopInfo(type) // 2.获取店铺信息
        if (shopInfo) {
          const evaluateList = await this.getEvaluateList(type) // 3.获取评价列表
          if (evaluateList) {
            // 设置上传数据
            GM_setValue('postData', {
              commodityList,
              shopInfo,
              evaluateList
            })

            // 跳转资质页面
            if (type == 1) { //旧店铺页面
              const tab = document.getElementsByClassName('shop-tab-2ipt1')[2]
              tab.click()
              document.getElementsByClassName('detail-XxlGz')[0].click()
            }
            if (type == 2) { //新店铺页面
              this.getNewShopTab(2).click()
              await this.delay(500)
              document.getElementsByClassName('view-shop-qualification-btn radius-border-1px-gray')[0].click()
            }

          } else {
            this.updateShopsById(shop_id, -1, 'evaluateList')
          }
        } else {
          this.updateShopsById(shop_id, -1, 'shopInfo')
        }
      } else {
        this.updateShopsById(shop_id, -1, 'commodityList')
      }
    },
    // 关闭窗口
    closeWindow: function closeWindow() {
      const userAgent = navigator.userAgent;
      if (userAgent.indexOf("Firefox") != -1 || userAgent.indexOf("Chrome") != -1) {
        window.location.href = "about:blank";
        window.close();
      } else {
        window.opener = null;
        window.open("", "_self");
        window.close();
      }
    },
    // 获取资质页面数据
    getAptitudeInfo: async function (type) {
      const shop_id = GM_getValue('curShop')['id']
      await this.delay(1000) //延时1s确保dom和数据加载
      const aptitude = await this.getAptitude(type) // 4.获取资质信息
      if (aptitude) {
        this.updateShopsById(shop_id, 2)// 设置状态=>上传中
        let postData = GM_getValue('postData')
        postData.aptitude = aptitude
        // 开始上传
        const result = await this.postDataToServer(postData)
        if (result) { //上传成功
          this.updateShopsById(shop_id, 3)// 设置状态=>已完成
          GM_setValue('postData', null) //清空采集的数据缓存
          GM_setValue('working', false)  //开启下一个进程
          GM_setValue('working', true)  //开启下一个进程
          // 完成采集总数+1
          const completeCount = GM_getValue('completeCount') == undefined ? 0 : GM_getValue('completeCount')
          GM_setValue('completeCount', completeCount + 1)
          this.closeWindow() //关闭窗口
        }
      } else {
        this.updateShopsById(shop_id, -1, 'aptitude')
      }
    }
  }



  window.onload = function () {
    const pathName = window.location.pathname
    if (pathName == '/' || pathName == '/msite/') { //主页面
      eleme.init()
    }
    if (pathName == '/shop/' || pathName == '/newretail/p/shop/') { //店铺详情页
      eleme.getDetailInfo(pathName == '/shop/' ? 1 : 2)
    }
    if (pathName == '/shop/certification/' || pathName == '/newretail/p/certification/') { //资质页面
      eleme.getAptitudeInfo(pathName == '/shop/certification/' ? 1 : 2)
    }
  }

})()