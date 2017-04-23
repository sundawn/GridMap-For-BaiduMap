
var gridMap = null;
var testData = [];
var miles = 500;//栅格大小，单位米

$(function () {

    //选择透明度
    $('#selectOpacity').change(function () {
        gridMap.setOpacity($(this).val());
        gridMap.clear();
        getGrids();
    });

    //切换画图模式
    $('#selectDrawMode').change(function () {
        gridMap.clear();
        getGrids()
    });

    //切换颜色模式
    $('#selectColorMode').change(function () {
        gridMap.setColorMode($(this).val());
        gridMap.clear();
        getGrids()
    });

    var map = new BMap.Map("mapContent", { enableMapClick: false });          // 创建地图实例
    map.setMinZoom(8);  //设置地图最小级别
    map.setMaxZoom(19);  //设置地图最大级别

    var point = new BMap.Point(113.12, 23.02);

    map.centerAndZoom(point, 11);

    map.enableScrollWheelZoom(); // 允许滚轮缩放
    map.setDefaultCursor("url('bird.cur')");
    map.enableDragging();
    map.disableDoubleClickZoom();

    var top_left_control = new BMap.ScaleControl({ anchor: BMAP_ANCHOR_TOP_LEFT });// 左上角，添加比例尺
    var top_left_navigation = new BMap.NavigationControl();  //左上角，添加默认缩放平移控件

    map.addControl(top_left_control);
    map.addControl(top_left_navigation);

    //缩放或者移动地图时要重新绘制界面
    map.addEventListener('zoomstart', zoomStart);
    map.addEventListener('zoomend', zoomEnd);
    map.addEventListener('moveend', moveEnd);

    map.addEventListener('click', clickMap);

    var thresholds = [{ "threshold": "<=10", "text": "恶劣", "color": "#FF0000", "gradient": 0.83 },
                { "threshold": "<=30", "text": "极差", "color": "#FF6600", "gradient": 0.66 },
                { "threshold": "<=50", "text": "较差", "color": "#FFF21F", "gradient": 0.5 },
                { "threshold": "<=60", "text": "中等", "color": "#2DFF3B", "gradient": 0.33 },
                { "threshold": "<=70", "text": "良好", "color": "#7ED354", "gradient": 0.16 },
                { "threshold": ">80", "text": "优秀", "color": "#00B354", "gradient": 0 }];

    initColorBar(thresholds);

    gridMap = new GridMap(map
        , {
            readTileData: onReadTileData,//瓦片获取数据事件
            thresholds: thresholds,//门限
            opacity: $('#selectOpacity').val(),//透明度
            colorMode: $('#selectColorMode').val()//gradient:渐变的方式呈现颜色；normal:按区间匹配颜色
        });

});

//点击栅格
function clickMap(e) {

    //获取栅格对应的数据
    var result = $.grep(testData, function (arr) {
        var minLng = arr[0];
        var minLat = arr[1];
        var maxLng = arr[2];
        var maxLat = arr[3];
        return (minLat <= e.point.lat && maxLat >= e.point.lat) && (minLng <= e.point.lng && maxLng >= e.point.lng);
    });

    if (result && result.length > 0) {
        alert(result[0][4]);
    }
}

//获取瓦片的栅格数据
function onReadTileData(sw, ne, tileCoord) {

    //生成测试数据，一般用ajax获取服务器数据
    var data = generateGrids(new BMap.Bounds(sw, ne), miles);

    var startTime = new Date();

    //绘制栅格数据
    //如果是ajax获取数据，在回调方法里面调用
    gridMap.drawTile(sw, ne, tileCoord, data);

    console.log("绘制图片耗时:" + (new Date() - startTime) + ",数据量:" + data.length);

    //存起来纯粹为了地图点击事件
    testData = testData.concat(data);
}

function zoomStart(e) {
    gridMap.clear();
}

function zoomEnd(e) {
    getGrids();
}

function moveEnd(e) {
    gridMap.clear();
    setTimeout(getGrids, 100);
}


//获取数据
function getGrids() {

    //按全屏的方式绘制图片
    if ($('#selectDrawMode').val() == "all") {

        //生成测试数据，一般用ajax获取服务器数据
        testData = generateGrids(gridMap.map.getBounds(), miles);

        var startTime = new Date();
        gridMap.draw(testData);
        console.log("绘制图片耗时:" + (new Date() - startTime) + ",数据量:" + testData.length);
    }
    else {
        //获取瓦片
        gridMap.getTiles();

        //展示瓦片区域
        //gridMap.showTiles();

        testData = [];
        //按瓦片的方式绘制图片
        gridMap.drawTiles();
    }
}


//初始化右下角颜色区间
function initColorBar(thresholds) {
    $.each(thresholds, function (i, item) {
        $('#colorBar').append('<li style="background-color:' + item.color + '; border:1px solid ' + item.color + ';">' + item.text + '：' + item.threshold + '</li>');
    });
}

//生成测试数据
function generateGrids(bounds, miles) {

    var startTime = new Date();

    var data = [];
    var boundsSw = bounds.getSouthWest();
    var boundsNe = bounds.getNorthEast();

    var sw = boundsSw;
    var ne = getGridNe(boundsSw, 1, 1, miles);

    data.push([sw.lng, sw.lat, ne.lng, ne.lat, Math.random() * 100]);

    var perLng = ne.lng - sw.lng;
    var perLat = ne.lat - sw.lat;

    for (lng = sw.lng; lng <= boundsNe.lng; lng = lng + perLng) {
        for (lat = sw.lat; lat <= boundsNe.lat; lat = lat + perLat) {
            ne = getGridNe(new BMap.Point(lng, lat), 1, 1, miles);

            if (ne.lng >= boundsNe.lng) { ne.lng = boundsNe.lng; }
            if (ne.lat >= boundsNe.lat) { ne.lat = boundsNe.lat; }

			var value= Math.random() * 100 ;
            data.push([lng, lat, ne.lng, ne.lat, value>70 ? value - Math.random() * 15 : (value <30 ? value + Math.random() * 20 : value) ]);
        }
    }

    console.log("生成数据成功，耗时:" + (new Date() - startTime));

    return data;
}

//生成网格右上角的经纬度
function getGridNe(point, offsetX, offsetY, miles) {
    var convert = new BaiduPointConvert(gridMap.map);
    return new BMap.Point(point.lng + offsetX * convert.milesToLng(point, miles), point.lat + offsetY * convert.milesToLat(point, miles));
}