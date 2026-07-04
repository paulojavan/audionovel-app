import assert from "node:assert/strict";
import test from "node:test";
import {
  getConfiguredHosts,
  isSafeImageHttpsUrl,
  isSafeMediaHttpsUrl,
  isSafePublicHttpsUrl,
} from "./url-security";

test("accepts public https URLs", () => {
  assert.equal(isSafePublicHttpsUrl("https://cdn.example.com/audio/file.mp3"), true);
  assert.equal(isSafePublicHttpsUrl("https://images.unsplash.com/photo.jpg"), true);
});

test("rejects non-https URLs", () => {
  assert.equal(isSafePublicHttpsUrl("http://cdn.example.com/audio/file.mp3"), false);
  assert.equal(isSafePublicHttpsUrl("file:///etc/passwd"), false);
});

test("rejects localhost and private network hosts", () => {
  assert.equal(isSafePublicHttpsUrl("https://localhost/audio.mp3"), false);
  assert.equal(isSafePublicHttpsUrl("https://127.0.0.1/audio.mp3"), false);
  assert.equal(isSafePublicHttpsUrl("https://10.1.2.3/audio.mp3"), false);
  assert.equal(isSafePublicHttpsUrl("https://172.16.0.1/audio.mp3"), false);
  assert.equal(isSafePublicHttpsUrl("https://192.168.0.1/audio.mp3"), false);
  assert.equal(isSafePublicHttpsUrl("https://[::1]/audio.mp3"), false);
});

test("rejects malformed URLs", () => {
  assert.equal(isSafePublicHttpsUrl("not a url"), false);
  assert.equal(isSafePublicHttpsUrl(""), false);
});

test("rejects URLs with embedded credentials", () => {
  assert.equal(
    isSafePublicHttpsUrl("https://user:password@media.example/audio.mp3", ["media.example"]),
    false,
  );
});

test("restricts media to configured hosts and subdomains", () => {
  assert.equal(isSafePublicHttpsUrl("https://cdn.media.example/audio.mp3", ["media.example"]), true);
  assert.equal(isSafePublicHttpsUrl("https://other.example/audio.mp3", ["media.example"]), false);
});

test("mantem allowlists de audio e imagem independentes", () => {
  const previousMediaHosts = process.env.MEDIA_URL_ALLOWED_HOSTS;
  const previousImageHosts = process.env.IMAGE_URL_ALLOWED_HOSTS;
  process.env.MEDIA_URL_ALLOWED_HOSTS = "audio.example";
  process.env.IMAGE_URL_ALLOWED_HOSTS = "images.example";

  try {
    assert.ok(getConfiguredHosts("MEDIA_URL_ALLOWED_HOSTS").includes("audio.example"));
    assert.equal(isSafeMediaHttpsUrl("https://audio.example/book.mp3"), true);
    assert.equal(isSafeMediaHttpsUrl("https://images.example/book.mp3"), false);
    assert.equal(isSafeImageHttpsUrl("https://images.example/cover.jpg"), true);
    assert.equal(isSafeImageHttpsUrl("https://audio.example/cover.jpg"), false);
  } finally {
    if (previousMediaHosts === undefined) delete process.env.MEDIA_URL_ALLOWED_HOSTS;
    else process.env.MEDIA_URL_ALLOWED_HOSTS = previousMediaHosts;
    if (previousImageHosts === undefined) delete process.env.IMAGE_URL_ALLOWED_HOSTS;
    else process.env.IMAGE_URL_ALLOWED_HOSTS = previousImageHosts;
  }
});

test("inclui os quatro shards explicitos do proxy de imagens WordPress", () => {
  const imageHosts = getConfiguredHosts("IMAGE_URL_ALLOWED_HOSTS");

  for (const host of ["i0.wp.com", "i1.wp.com", "i2.wp.com", "i3.wp.com"]) {
    assert.ok(imageHosts.includes(host));
  }
});

test("autoriza o bucket R2 usado pelos audios publicados", () => {
  assert.equal(
    isSafeMediaHttpsUrl(
      "https://pub-71184de2196c4369bcdb615e4c5e985a.r2.dev/capitulo.mp3",
    ),
    true,
  );
});

test("autoriza qualquer subdominio publico do Cloudflare R2", () => {
  assert.equal(
    isSafeMediaHttpsUrl(
      "https://pub-4684220593db49858eb8eea0e3b7b910.r2.dev/audio.mp3",
    ),
    true,
  );
});

test("nao confunde dominio falso com Cloudflare R2", () => {
  assert.equal(isSafeMediaHttpsUrl("https://r2.dev.exemplo.com/audio.mp3"), false);
  assert.equal(isSafeMediaHttpsUrl("http://bucket.r2.dev/audio.mp3"), false);
});
