# CP0.2 v9 B Audio Audit — Reproduction Method

状态：`TECH evidence supporting CP0.3 review; not a subjective listening result`

审计对象是 [B-ring-first-v9-qr-deferred-exposure.mp4](../../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/B-ring-first-v9-qr-deferred-exposure.mp4)，SHA-256 为 `803219d86089d0141db1694c760897b300555dfb9e4991adfe7bb9753e4b135e`。先验证 hash；不同文件不得复用本结果。

```sh
AB_V9_B='apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/B-ring-first-v9-qr-deferred-exposure.mp4'
shasum -a 256 "$AB_V9_B"
```

以下命令以 FFmpeg `8.1` 复跑；核心参数是固定的，版本差异若改变数值则应记录而非静默覆盖。AAC 输入为 stereo / `44100Hz`，所有音频技术量测均解码为 stereo / `44100Hz` 的 normalized `f32le` PCM。

## 静默 pocket

```sh
ffmpeg -hide_banner -nostdin -i "$AB_V9_B" -map 0:a:0 \
  -af 'silencedetect=noise=-60dB:d=0.05' -f null - 2>&1 \
  | rg 'silence_(start|end|duration)'
```

`noise=-60dB` 是静默阈值，`d=0.05` 是最短连续时长。除网页前缀静默外，B 的重排 pocket 必须输出：

```text
silence_start: 10.433288
silence_end: 10.539274 | silence_duration: 0.105986
```

## RMS 窗口与公式

审计使用两个半开 `200ms` 窗口：重排静默前 `[10.233288, 10.433288)`，静默后 `[10.539274, 10.739274)`。每个命令应读取 `astats` 的 **Overall RMS level dB**，不是单独某一声道的值。

```sh
ffmpeg -hide_banner -nostdin -i "$AB_V9_B" -map 0:a:0 \
  -af 'atrim=start=10.233288:end=10.433288,asetpts=PTS-STARTPTS,aformat=sample_fmts=flt:sample_rates=44100:channel_layouts=stereo,astats=metadata=0:reset=0' \
  -f null - 2>&1 | rg -A 3 'Overall'

ffmpeg -hide_banner -nostdin -i "$AB_V9_B" -map 0:a:0 \
  -af 'atrim=start=10.539274:end=10.739274,asetpts=PTS-STARTPTS,aformat=sample_fmts=flt:sample_rates=44100:channel_layouts=stereo,astats=metadata=0:reset=0' \
  -f null - 2>&1 | rg -A 3 'Overall'
```

令 `x[c,n]` 为声道 `c∈{L,R}` 的 normalized float PCM，`N` 为窗口的 sample-frame 数，则：

`RMS_dBFS = 20 × log10(sqrt(Σ x[c,n]² / (2N)))`。

期望 Overall RMS 分别为 `−14.057522 dBFS` 与 `−30.830711 dBFS`，即约 `16.773189dB`（摘要中四舍五入为 `16.77dB`）的能量下降。

## 相邻 sample jump

解码参数固定为：`-map 0:a:0 -vn -ac 2 -ar 44100 -f f32le -`。计算的是同一声道的连续 sample 差：`max(abs(x[c,n+1] − x[c,n]))`；不能把 interleaved PCM 相邻的 L/R 当成时间相邻 sample。

下列命令限制候选分析范围为视频的 `667 / 30s = 22.233333333s`（`980490` stereo sample frames），从而排除 AAC 解码尾部 padding。它会输出两个边界各 `±20ms` 窗口和整个候选的最大跳变。

```sh
ffmpeg -hide_banner -nostdin -v error -i "$AB_V9_B" -map 0:a:0 -vn -ac 2 -ar 44100 -f f32le - \
  | node -e '
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const raw = Buffer.concat(chunks);
  const pcm = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
  const rate = 44100, channels = 2, candidateFrames = 667 * rate / 30;
  const maxJump = (start, end) => {
    const first = Math.max(0, Math.ceil(start * rate));
    const last = Math.min(candidateFrames - 1, Math.floor(end * rate));
    let max = 0;
    for (let n = first; n < last; n += 1) {
      for (let c = 0; c < channels; c += 1) {
        max = Math.max(max, Math.abs(pcm[(n + 1) * channels + c] - pcm[n * channels + c]));
      }
    }
    return max;
  };
  console.log(JSON.stringify({
    silenceStartPlusMinus20ms: maxJump(10.413288, 10.453288),
    silenceEndPlusMinus20ms: maxJump(10.519274, 10.559274),
    wholeCandidate: maxJump(0, 667 / 30)
  }, null, 2));
});'
```

期望值分别为 `0.002096433`、`0.013424266` 和 `0.167042723`。因此审计摘要的边界最大值 `0.0134` 不显示 sample-level click；它不说明音乐的 `16.77dB` 能量落差在主观上一定自然。该判断仍由作者戴耳机完成。
