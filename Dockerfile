# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:24.22.2-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS frontend
WORKDIR /app
RUN npm install --global pnpm@10.34.9
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY index.html vite.config.ts tsconfig*.json tailwind.config.js postcss.config.js ./
COPY public ./public
COPY src ./src
RUN pnpm build

FROM --platform=$BUILDPLATFORM golang:1.27.3-alpine@sha256:d200d2dd76b03a99b52651fd1325aff7dcd35422c35c01bac56571b0507f3deb AS backend
WORKDIR /app
ENV GOTOOLCHAIN=local
COPY backend/go.mod backend/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY backend/ ./
COPY --from=frontend /app/dist ./ui/dist
ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} go build -trimpath -ldflags="-s -w" -tags=prod -o /out/garage-webui .

FROM scratch
LABEL org.opencontainers.image.title="Garage WebUI" \
      org.opencontainers.image.source="https://github.com/TheophileDiot/garage-webui" \
      org.opencontainers.image.licenses="MIT"
COPY --from=backend /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=backend /out/garage-webui /garage-webui
USER 65532:65532
EXPOSE 3909
HEALTHCHECK --interval=30s --timeout=3s --retries=3 --start-period=10s CMD ["/garage-webui", "healthcheck"]
ENTRYPOINT ["/garage-webui"]
