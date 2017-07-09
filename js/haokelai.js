//创建模块
var app = angular.module('kfl',['ng','ngRoute']);

//创建自定义服务---防抖动处理
app.factory('$debounce', ['$rootScope', '$browser', '$q', '$exceptionHandler',
  function($rootScope, $browser, $q, $exceptionHandler) {
    var deferreds = {},
      methods = {},
      uuid = 0;

    function debounce(fn, delay, invokeApply) {
      var deferred = $q.defer(),
        promise = deferred.promise,
        skipApply = (angular.isDefined(invokeApply) && !invokeApply),
        timeoutId, cleanup,
        methodId, bouncing = false;

      // check we dont have this method already registered
      angular.forEach(methods, function(value, key) {
        if (angular.equals(methods[key].fn, fn)) {
          bouncing = true;
          methodId = key;
        }
      });

      // not bouncing, then register new instance
      if (!bouncing) {
        methodId = uuid++;
        methods[methodId] = { fn: fn };
      } else {
        // clear the old timeout
        deferreds[methods[methodId].timeoutId].reject('bounced');
        $browser.defer.cancel(methods[methodId].timeoutId);
      }

      var debounced = function() {
        // actually executing? clean method bank
        delete methods[methodId];

        try {
          deferred.resolve(fn());
        } catch (e) {
          deferred.reject(e);
          $exceptionHandler(e);
        }

        if (!skipApply) $rootScope.$apply();
      };

      timeoutId = $browser.defer(debounced, delay);

      // track id with method
      methods[methodId].timeoutId = timeoutId;

      cleanup = function(reason) {
        delete deferreds[promise.$$timeoutId];
      };

      promise.$$timeoutId = timeoutId;
      deferreds[timeoutId] = deferred;
      promise.then(cleanup, cleanup);

      return promise;
    }


    // similar to angular's $timeout cancel
    debounce.cancel = function(promise) {
      if (promise && promise.$$timeoutId in deferreds) {
        deferreds[promise.$$timeoutId].reject('canceled');
        return $browser.defer.cancel(promise.$$timeoutId);
      }
      return false;
    };

    return debounce;
  }
]);


//配置路由词典
app.config(function($routeProvider){
  //添加路由信息
  $routeProvider.when('/start',{  //接收参数的项目 ---> :id
    templateUrl:'tpl/start.html',
    controller:'startCtrl'  //创建单一对象的控制器，只供自己调用使用,其他用的时候还需要创建各自的控制器
  })//配置接收方路由
    .when('/main',{
      templateUrl:'tpl/main.html',
      controller:'mainCtrl'
    })
    .when('/detail/:id',{
      templateUrl:'tpl/detail.html',
      controller:'detailCtrl'
    })
    .when('/order/:id',{
      templateUrl:'tpl/order.html',
      controller:'orderCtrl'
    })
    .when('/myOrder',{
      templateUrl:'tpl/myOrder.html',
      controller:'myOrderCtrl'
    })
    //当当前页面中路由地址不是配置的任何一个，将执行otherwise方法
    .otherwise({redirectTo:'/start'})
});


//创建一个body控制器，给body使用---其他所有的对象都可以使用这个控制器继承他的方法，希望所有的代码片段都能够调用该控制器中封装的变量和方法
app.controller('parentCtrl',['$scope','$location',function($scope,$location){
  //通过$location跳转到设置页面
  //跳转到指定的路由地址对应的页面
  $scope.jumpRoute = function(desPath){
    $location.path(desPath);   //跳转到目标地址----调用的时候传参
  }
}]);


//给设置页面创建控制器(给谁接收参数就给谁创建控制器)--接收参数的对象的控制器--且把参数发送过去
app.controller('startCtrl',['$scope','$routeParams',function($scope,$routeParams){
  console.log($routeParams);
  $scope.result = $routeParams.id;
}
]);

//main页面加载--产品的信息
app.controller('mainCtrl',
  ['$scope', '$http','$debounce',function ($scope, $http,$debounce) {
      $scope.hasMore = true;
      //  加载到代码片段，进到控制器处理函数中，发起请求拿数据
       $http.get('data/dish_getbypage.php?start=0')
          .success(function (data) {
          //console.log(data);
          $scope.dishList = data;
        });

      //  监听用户的输入
      $scope.$watch('kw', function () {
        //放抖动处理
        $debounce(watchHandler,300);
      });

      watchHandler = function () {
        console.log($scope.kw);
        if ($scope.kw) {
          $http
            .get('data/dish_getbykw.php?kw=' + $scope.kw)
            .success(function (data) {
              console.log(data);
              //搜索是由结果的
              if (data.length > 0) {
                //将搜索到的结果显示在main页面的列表上
                $scope.dishList = data;
              }
            })
        }
      };

    //加载更多数据
   $scope.loadMore = function(){
    $http.get('data/dish_getbypage.php?start='+$scope.dishList.length)
      .success(function(data){
        if(data.length<5){
           $scope.hasMore = false;
        }
        //将返回的新的数组 和 之前的dishList拼接
        //比如本来：[1,2,3],返回[4,5]--> 【1,2,3,4,5】
         $scope.dishList = $scope.dishList.concat(data);
      });

  };

  //监听kw模型的变化
  $scope.$watch('kw',function(){
    console.log($scope.kw);
    //向服务器端发起请求进行关键字查询
    if($scope.kw.length>0){
      $http.get('data/dish_getbykw.php?kw='+$scope.kw)
        .success(function(data){
          console.log('查询结果为'+data);
          if(data.length>0){
            //将data数组中数据显示在视图中
            $scope.dishList=data;
          }
        });
    }
  });
}]);

//点击main页面的图片跳转到对应的详情页
app.controller('detailCtrl',
   ['$scope', '$http', '$routeParams',
     function ($scope, $http, $routeParams) {
       var did = $routeParams.id;
       console.log(did);
       $http.get('data/dish_getbyid.php?id=' + did)
        .success(function (data) {
          console.log(data);
          $scope.dish = data[0];
        })
    }
  ]);

//order页面--点击确定下单--跳转
app.controller('orderCtrl', [
  '$scope', '$routeParams', '$http', '$httpParamSerializerJQLike',
  function ($scope, $routeParams, $http, $httpParamSerializerJQLike) {

    $scope.order = {did: $routeParams.id};

    $scope.submitOrder = function () {
      //先去获取用户输入的各个信息
      console.log($scope.order);

      //将输入的信息 发送 给服务器端
      var params = $httpParamSerializerJQLike($scope.order);
      console.log(params);

      $http.get('data/order_add.php?' + params)
          .success(function (data) {
          //解析服务端返回的结果
          console.log(data);
          if (data[0].msg == 'succ') {
            $scope.result = "下单成功，订单编号为" + data[0].oid;
            //方案1
            sessionStorage.setItem('phone', $scope.order.phone);
            //方案2 $rootScope
          }
          else {
            $scope.result = "下单失败！";
          }
        })
    }
  }
]);

//myOrder--我的订单中心页面
app.controller('myOrderCtrl', ['$scope', '$http', function ($scope, $http) {
    //拿到手机号
    var phone = sessionStorage.getItem('phone');
    console.log(phone);
    //发起网络请求
    $http.get('data/dish_getbyphone.php?phone=' + phone)
         .success(function (data) {
        //将服务器端返回的订单列表保存在$scope中的orderList
         $scope.orderList = data;
      })
  }
]);


