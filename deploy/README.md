# Docker 部署

仓库提供可公开的部署模板，实际主机名、IP、用户名和当前镜像版本保存在各部署环境自己的配置中。模板默认仅监听本机；在 `.env` 中设置局域网地址后，同一 Wi-Fi 的手机才可访问。

## 安装

1. 在目标服务器创建部署目录，例如 `~/apps/partygame`。
2. 将 `compose.example.yml` 复制为部署目录下的 `compose.yaml`，将 `.env.example` 复制为 `.env`。
3. 在 `.env` 填入构建好的 `PARTYGAME_IMAGE`、主机局域网地址 `PARTYGAME_BIND_IP`，以及用于写入数据目录的 UID/GID（可分别用 `id -u`、`id -g` 查询）。
4. 创建 `data/`，确保容器配置的用户能够写入，并限制目录访问权限。
5. 运行 `docker compose up -d --wait --wait-timeout 45`，使用 `docker compose ps` 检查健康状态。

浏览器访问 `http://<配置的地址>:4173`。房主通过页面邀请链接或二维码邀请玩家。身份凭证按地址保存，同一玩家在游戏中应继续使用原来的访问地址。

需要同时监听 VPN 地址时，在服务器的私有 Compose 配置中额外添加该地址对应的端口映射，不要提交实际地址。此模板不配置公网代理或路由器端口转发。

## 运行与数据

- `.env`：当前已验证的镜像标签、监听地址及运行用户；不提交。
- `data/rooms.json`：玩家身份摘要、昵称、投稿和完整牌面；不能公开。容器更新或重启保留，未操作 24 小时后过期。
- `releases/<版本>/`：本地发布记录与备份；不提交。
- `restart: unless-stopped`：异常退出或 Docker 重启后自动恢复；人工停止后保持停止。
- 根文件系统只读，仅数据目录和临时目录可写。

## 更新及回退

本地运行 `npm test` 和 `npm run build`。把 `Dockerfile`、`.dockerignore`、`package.json`、`package-lock.json`、`server/`、`dist/` 和 `tests/` 放到目标服务器新的 release 目录。不要上传开发机器的 `.data`、`tmp`、环境文件或测试身份。

在新 release 目录构建独立版本标签，并在容器中验证：

```sh
docker build --pull=false -t partygame:<版本> .
docker run --rm --network none \
  --mount type=bind,src="$(pwd)/tests",dst=/app/tests,readonly \
  partygame:<版本> node --test tests/game.test.js
```

更新前备份部署目录的 `.env` 和 `data/`。将 `.env` 中的标签改为新版本后，运行 `docker compose up -d --wait --wait-timeout 45`。保留旧镜像；回退时恢复旧标签并再次启动。更新会短暂断线，客户端自动重连，持久化牌面不重新抽取。不要直接编辑进行中的房间数据。

## 验证范围

自动测试覆盖三种玩法、信息可见性、持久化和 12 人头像身份。跨主机 HTTP 客户端验证了房间流程与重启恢复。实体手机浏览器、系统后台遮盖及 Wi-Fi 设备隔离仍需在实际聚会网络中验证。
