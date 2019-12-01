# ha-panel-amap-panel
Amap map panel for home assistant

## 使用
1. 在 home assistant 的配置目录（configuration.yaml的所在目录），创建 panel 文件夹并将 amap-panel.html 放进去。
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
