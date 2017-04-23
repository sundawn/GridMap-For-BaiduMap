# GridMap-For-BaiduMap
基于百度地图的栅格地理化呈现

## 关于栅格
可以参考Arcgis关于的说明：
http://desktop.arcgis.com/zh-cn/arcmap/10.3/manage-data/raster-and-images/what-is-raster-data.htm

一般用一个矩形的左下角的经纬度和右上角经纬度定义一个栅格，并使用颜色呈现栅格内容。
数据量不大的时候，使用地图的画矩形方法就能简单地呈现栅格，但是不适合大量数据的呈现。
因此，本控件使用HTML5画布绘制完图片覆盖地图的方式解决创建矩形对象造成的效率问题，并支持以地图瓦片的粒度批量生成图片。


