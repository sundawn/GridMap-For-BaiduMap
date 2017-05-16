/*使用说明：

实例化：
 var gridMap = new GridMap(map, {
    readTileData: onReadTileData,//瓦片获取数据事件
    thresholds: thresholds,//门限
    opacity: 0.7,//透明度
    colorMode: 'gradient'//gradient:渐变的方式呈现颜色；normal:按区间匹配颜色
});

绘制栅格图：
1.按整个地图一张图片的方式绘制：
gridMap.draw(data);

2.按瓦片的方式绘制：
 gridMap.getTiles();
 gridMap.drawTiles();
 另外要在readTileData事件里面实现获取瓦片数据，最后再调用drawTile方法绘制瓦片

关于瓦片相关的地址：http://developer.baidu.com/map/wiki/index.php?title=jspopular/guide/maplayer
另外showTiles方法可以在界面画出当前地图的所有瓦片的区域

门限配置参数：
threshold：代表门限值
color：代表门限对应的颜色
gradient：门限对应的颜色区间

*/

function GridMap(map, option) {
    this.readTileData = option.readTileData;
    if (this.map == null) {
        this.map = map;
    }
    if (option.opacity) {
        this.setOpacity(option.opacity);
    }
    if (option.colorMode) {
        this.setColorMode(option.colorMode);
    }
    if (option.thresholds) {
        this.setThresholds(option.thresholds);
    }
    if (option.zIndex) {
        this.zIndex = option.zIndex;
    }

    //加载完成图层后设置瓦片的z-index
    (function (gridMap) {
        gridMap.map.addEventListener('tilesloaded', function (e) {
            if (gridMap) {
                gridMap.fixZIndex();
            }
        });
    })(this);
};

GridMap.prototype = {
    map: null,//百度地图对象
    opacity: 0.65,//透明度
    ranges: [],//数值区间，顺序存放，如[0,10,20]
    tileLayers: {},//瓦片图片字典
    imageLayer: null,//地图图片，如果不分瓦片呈现
    colorThresholds: [],//门限配置，用于普通绘制模式,按门限值顺序存放
    gradientTresholds: [],//渐变区间配置，用户绘制渐变模式，按区间值顺序排序
    tiles: [],//当前地图的瓦片列表
    readTileData: null,//获取瓦片数据事件
    colorMode: 'gradient',//range：按指定颜色呈现，gradient：渐变的方式呈现颜色
    zIndex: -1,
    isSetZIndex: false,
    //设置颜色模式
    setColorMode: function (mode) {
        if (mode === "gradient" || mode === "range") {
            this.colorMode = mode;
        }
    },
    //设置透明度
    setOpacity: function (opacity) {
        this.opacity = opacity;
    },
    //设置门限
    setThresholds: function (thresholds) {

        $.each(thresholds, function (i, item) {
            item.threshold = item.threshold.replace("<", "").replace(">", "").replace("=", '');
        });

        this.colorThresholds = thresholds.sort(function (a, b) { return a.threshold - b.threshold }).concat();
        this.gradientTresholds = thresholds.sort(function (a, b) { return a.gradient - b.gradient }).concat();

        this.ranges = $.map(thresholds, function (item) {
            return item.threshold;
        });
        this.ranges = $.unique(this.ranges).sort(function (a, b) { return a - b; });

    },
    //清除图层
    clear: function () {
        this.tiles = [];
        var $this = this;

        $.each(Object.keys(this.tileLayers), function (i, item) {
            if ($this.tileLayers[item] != null) {
                $this.map.removeOverlay($this.tileLayers[item]);
                $this.tileLayers[item] = null;
            }
        });

        if (this.imageLayer != null) {
            this.map.removeOverlay(this.imageLayer);
            this.imageLayer = null;
        }
    },
    //获取当前地图所有瓦片
    getTiles: function () {
        var convert = new BaiduPointConvert(this.map);
        var ne = this.map.getBounds().getNorthEast();//右上角经纬度
        var sw = this.map.getBounds().getSouthWest();//左下角经纬度

        var neTile = convert.lngLatToTile(ne);//右上角的瓦片
        neTile.x = Math.floor(neTile.x);
        neTile.y = Math.floor(neTile.y);

        var swTile = convert.lngLatToTile(sw);//左下角的瓦片
        swTile.x = Math.floor(swTile.x);
        swTile.y = Math.floor(swTile.y);

        this.tiles = [];
        for (var x = swTile.x; x <= neTile.x; x++) {
            for (var y = swTile.y; y <= neTile.y; y++) {
                this.tiles.push({ x: x, y: y });
            }
        }
    },
    //显示所有Tile，测试用
    showTiles: function () {
        var $this = this;
        $.each(this.tiles, function (i, item) {
            var image = $this.drawTileRect(item);
            $this.addTileToMap(item, image);
        });
    },
    //将瓦片图片添加到地图中
    //tileCoord:瓦片坐标，如{x:122,y:244}
    //image:图片数据
    addTileToMap(tileCoord, image) {

        var $this = this;
        var key = tileCoord.x + "_" + tileCoord.y;

        //计算瓦片所在的地图区域
        var convert = new BaiduPointConvert(this.map);
        var bounds = convert.tileToBounds(tileCoord);

        //删除瓦片已经加载的图片，避免重叠渲染
        if (this.tileLayers[key]) {
            $this.map.removeOverlay(this.tileLayers[key]);
        }

        var imageLayer = new BMap.GroundOverlay(new BMap.Bounds(bounds.sw, bounds.ne));
        imageLayer.setImageURL(image);
        imageLayer.OverlayType = 'GridLayer';
        this.map.addOverlay(imageLayer);
        this.tileLayers[key] = imageLayer;
    },
    //绘制瓦片的范围
    //tileCoord:瓦片坐标，如{x:122,y:244}
    drawTileRect: function (tileCoord) {

        var w = 256, h = 256;
        var canvas = $("<canvas width='" + w + "' height='" + h + "' ></canvas>");
        var context = canvas[0].getContext("2d");
        //随机背景颜色
        context.fillStyle = 'rgb(' + Math.floor(255 - 42.5 * Math.random() * 10) + ',' + Math.floor(255 - 42.5 * Math.random() * 10) + ',' + Math.floor(255 - 42.5 * Math.random() * 10) + ')';
        context.globalAlpha = this.opacity;
        context.strokeStyle = "black";
        context.fillRect(0, 0, w, h);
        //文字颜色
        context.fillStyle = "white";
        context.fillText(tileCoord.x + "," + tileCoord.y, w / 2 - 30, h / 2);

        //画边线
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, w);
        context.lineTo(w, h);
        context.lineTo(w, 0);
        context.lineTo(0, 0);
        context.closePath();
        context.stroke();
        var image = canvas[0].toDataURL();
        canvas = null;
        return image;
    },
    //分瓦片绘制地图
    drawTiles: function () {
        isSetZIndex = false;
        var $this = this;
        $.each(this.tiles, function (i, tileCoord) {
            if ($this.readTileData) {
                var convert = new BaiduPointConvert($this.map);
                var bounds = convert.tileToBounds(tileCoord);
                $this.readTileData(bounds.sw, bounds.ne, tileCoord);
            }
        });
    },
    //绘制瓦片
    //sw:瓦片的左下角经纬度
    //ne:瓦片的右上角经纬度
    //tileCoord:瓦片坐标
    //data:栅格数据，为二维数据，格式为[[最小经度,最小纬度,最大经度,最大纬度,栅格的值]]
    drawTile: function (sw, ne, tileCoord, data) {
        if (!data || this.colorThresholds.length == 0) { return; }

        var nePixel = this.map.pointToPixel(sw);
        var swPixel = this.map.pointToPixel(ne);
        var canvas = $("<canvas width='256' height='256'></canvas>");
        var context = canvas[0].getContext("2d");
        var $this = this;
        $.each(data, function (i, item) {
            $this.drawGrid(item, context, swPixel, nePixel);
        });

        this.addTileToMap(tileCoord, canvas[0].toDataURL());

    },
    //设置瓦片父级的DIV的z-index
    fixZIndex: function () {
        var $this = this;
        var div = null;
        if (this.imageLayer != null) {
            div = this.imageLayer.V;
        }
        else {
            var layerKeys = Object.keys(this.tileLayers);
            var layers = $.grep(layerKeys, function (key) { return $this.tileLayers[key] != null; })
            if (layers.length > 0) {
                var key = layers[0];
                div = this.tileLayers[key].V;
            }
        }
        if (div) {
            $(div).parent().css("z-index", this.zIndex);
        }
    },
    //绘制整个地图
    //data:栅格数据，为二维数据，格式为[[最小经度,最小纬度,最大经度,最大纬度,栅格的值]]
    draw: function (data) {

        if (this.colorThresholds.length == 0) { return; }

        var canvas = $('<canvas width=' + this.map.width + ' height=' + this.map.height + ' "></canvas>')
        var context = canvas[0].getContext("2d");

        var $this = this;
        $.each(data, function (i, item) {
            $this.drawGrid(item, context, { x: 0, y: 0 }, { x: 0, y: 0 });
        });

        this.imageLayer = new BMap.GroundOverlay(this.map.getBounds());
        this.imageLayer.setImageURL(canvas[0].toDataURL());
        this.imageLayer.OverlayType = 'GridLayer';
        this.map.addOverlay(this.imageLayer);


    },
    //绘制栅格
    drawGrid: function (arr, cxt, nePixel, swPixel) {

        var color = "";
        if (this.colorMode == "gradient") {
            //获取渐变颜色
            var rangValue = this.getRangeValue(arr[4]);
            color = Color.getGradientColor(this.gradientTresholds, rangValue);
        } else {
            //获取区间颜色
            color = Color.getColor(this.colorThresholds, arr[4]);
        }

        cxt.fillStyle = color;
        cxt.globalAlpha = this.opacity;

        var minLng = arr[0];
        var minLat = arr[1];
        var maxLng = arr[2];
        var maxLat = arr[3];

        var sw = this.map.pointToPixel(new BMap.Point(minLng, minLat));//左下
        var se = this.map.pointToPixel(new BMap.Point(maxLng, minLat));//右下
        var ne = this.map.pointToPixel(new BMap.Point(maxLng, maxLat));//右上
        var nw = this.map.pointToPixel(new BMap.Point(minLng, maxLat));//左上
        var w = ne.x - nw.x;
        var h = sw.y - nw.y;
        cxt.fillRect(nw.x - swPixel.x, nw.y - nePixel.y, w, h);
    },
    //获取渐变值
    getRangeValue: function (value) {

        var perRange = 100.00 * 1 / (this.ranges.length + 1);
        var result = 0;

        var max = this.ranges[this.ranges.length - 1];
        if (value > max) {
            result = 0;
        }
        else {
            for (var i = 0; i < this.ranges.length; i++) {
                if (value == this.ranges[i]) {
                    result = perRange * (this.ranges.length + 1 - i);
                    break;
                }
                else if (value < this.ranges[i]) {
                    if (i == 0) {
                        result = 100;
                    }
                    else {
                        result = perRange * (this.ranges.length + 1 - i) + (this.ranges[i] - value) * perRange * (1.00 / (this.ranges[i] - this.ranges[i - 1]));
                    }
                    break;
                }
            }
        }

        return (result * 0.01).toFixed(2);
    },

}

var Color = {
    //16进制颜色代码转RGB颜色代码
    hexToRgb: function (hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : hex;
    }
    ,
    //RGB颜色代码
    rgb: function (r, g, b) {
        r = Math.floor(r);
        g = Math.floor(g);
        b = Math.floor(b);
        return ["rgb(", r, ",", g, ",", b, ")"].join("");
    },
    //获取区间颜色
    getColor: function (thresholds, value) {
        var filters = $.grep(thresholds, function (item) { return item.threshold >= value })
        return filters.length == 0 ? $(thresholds).last()[0].color : filters[0].color;
    },
    //获取渐变颜色
    getGradientColor: function (thresholds, value) {

        if (!thresholds || thresholds.length == 0) { return; }

        var beginColor = thresholds[0];
        var endColor = null;

        for (var i = thresholds.length - 1; i >= 0; i--) {
            if (thresholds[i].gradient <= value) {
                beginColor = thresholds[i];
                endColor = thresholds[i == 0 ? 0 : i - 1];
                break;
            }
        }

        var diffR = 1;
        var diffG = 1;
        var diffB = 1;

        var perRange = 1.0 / thresholds.length;

        var rate = 1 - (value - beginColor.gradient) / perRange;

        var end = Color.hexToRgb(endColor.color);
        var begin = Color.hexToRgb(beginColor.color);

        //三原色改变步长
        diffR = (end.r - begin.r) * rate;
        diffG = (end.g - begin.g) * rate;
        diffB = (end.b - begin.b) * rate;

        var r = begin.r + Math.ceil(diffR);
        var g = begin.g + Math.ceil(diffG);
        var b = begin.b + Math.ceil(diffB);

        return Color.rgb(r, g, b);
    },
};

//百度地图坐标转换
//参考文章：http://www.jianshu.com/p/e380ed9f5fcf
var BaiduPointConvert = function (map) {
    this.map = map;
    //瓦片xy计算出经纬度坐标
    //step1: this.tileToPixel(pixel);百度地图瓦片大小为 256*256，根据 瓦片xy * 256计算出瓦片的像素坐标；
    //step2 : this.pixelToWorld(this.tileToPixel(pixel)) ; 将像素坐标转为平面坐标。
    //step3: this.worldToLngLat(this.pixelToWorld(this.tileToPixel(pixel))); 调用API提供的方法将平面坐标转为经纬度坐标；
    //API说明请参考：http://developer.baidu.com/map/reference/index.php?title=Class:%E5%9C%B0%E5%9B%BE%E7%B1%BB%E5%9E%8B%E7%B1%BB/Projection
    this.tileToLngLat = function (pixel) {
        return this.worldToLngLat(this.pixelToWorld(this.tileToPixel(pixel)));
    }
    this.lngLatToTile = function (lngLat) {
        return this.pixelToTile(this.worldToPixel(this.lngLatToWorld(lngLat)));
    }
    this.pixelToLngLat = function (pixel) {
        return this.worldToLngLat(this.pixelToWorld(pixel));
    }
    this.lngLatToPixel = function (lngLat) {
        return this.worldToPixel(this.lngLatToWorld(lngLat));
    }
    this.tileToPixel = function (pixel) {
        return new BMap.Pixel(pixel.x * 256,
            pixel.y * 256);
    }
    this.pixelToWorld = function (pixel) {
        var zoom = this.map.getZoom();
        return new BMap.Pixel(pixel.x / Math.pow(2, zoom - 18),
            pixel.y / Math.pow(2, zoom - 18));
    }
    this.worldToLngLat = function (pixel) {
        var projection = this.map.getMapType().getProjection();
        return projection.pointToLngLat(pixel)
    }
    this.pixelToTile = function (pixel) {
        return new BMap.Pixel(pixel.x / 256,
            pixel.y / 256);
    }
    this.worldToPixel = function (pixel) {
        var zoom = this.map.getZoom();
        return new BMap.Pixel(pixel.x * Math.pow(2, zoom - 18),
            pixel.y * Math.pow(2, zoom - 18));
    }
    this.lngLatToWorld = function (lngLat) {
        var projection = this.map.getMapType().getProjection();
        return projection.lngLatToPoint(lngLat)
    },
    //根据瓦片编号获取瓦片的经纬度
    this.tileToBounds = function (tileCoord) {
        var sw = this.tileToLngLat(tileCoord);//瓦片左下角坐标；
        var ne = this.tileToLngLat({ x: tileCoord.x + 1, y: tileCoord.y + 1 });//瓦片右上角坐标；
        return {
            sw: sw,
            ne: ne
        };
    },
    //根据距离计算经度
    this.milesToLng = function (point, miles) {
        var p2 = new BMap.Point(point.lng + 1, point.lat);
        var distance = this.map.getDistance(point, p2);
        return miles / distance;
    },
    //根据距离计算纬度
    this.milesToLat = function (point, miles) {
        var p2 = new BMap.Point(point.lng, point.lat + 1);
        var distance = this.map.getDistance(point, p2);
        return miles / distance;
    }
}
