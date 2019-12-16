# leaflet.tools.measure

## leaflet 测距工具

### DEMO
[https://loongship.github.io/leaflet.tools.measure/examples/index.html](https://loongship.github.io/leaflet.tools.measure/examples/index.html)

###  安装
```
npm install leaflet.tools.measure
```

### 开启测距的两种方法

1. 初始化地图的时候增加measureControl 属性,控件右下角会出现测绘控件.

    ```
    var map = L.map('map', {
        center: [31, 122],
        measureControl: true,   //初始化传入参数measureControl
        zoom: 5
    })
    ```
2. 控件单独初始化
    ```
    var control = L.control.measure({}).addTo(map)
    ```
### 常用方法

```
//开启测距
control.start()

//关闭测距
control.stop()
```


### 主意
单位长度为`海里`,当距离大于1000米的时候显示`海里`
