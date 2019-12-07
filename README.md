# ha-panel-amap-panel
Amap map panel for home assistant

## 使用
1. 在 home assistant 的配置目录（configuration.yaml的所在目录），创建 panels 文件夹并将 amap-panel.html 放进去。
2. 配置 configuration.yaml 文件，加入如下配置：

```yaml
panel_custom:
    - name: amap-panel
      sidebar_title: 高德地图
      sidebar_icon: mdi:map
      url_path: amap-panel
      trust_external_script: true
      config:
          key: 高德地图Web端key
```
3. 重启 home assistant, enjoy your self!

## 截图
![截图](./WX20191201-160333@2x.png)

## 问题
```
有问题请提issue，谢谢！
```
1. 高德地图key申请 https://lbs.amap.com/dev/key/app

## 日志
```
2019-12-07
1.修复zone图标不居中问题
2.优化设备位置更新算法，设备位置刷新更平滑

2019-12-02
1.修复首次加载白屏
2.修复图标偏移
3.使用通用坐标转换方法，修复坐标不正确的问题
4.略微放大了设备图标
```
