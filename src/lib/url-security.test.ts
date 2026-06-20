import assert from "node:assert/strict";
import test from "node:test";
import { isSafePublicHttpsUrl } from "./url-security";

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
