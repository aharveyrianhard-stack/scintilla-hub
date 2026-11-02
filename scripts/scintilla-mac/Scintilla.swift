// Scintilla.app (1 Nov 2026, coordinator). The cards on each Mac. Alan: "I get so many, and then I feel like I don't see like a stream of notifications coming in on the
// computers. I need the notifications coming everywhere ... if we can make that have the Scintilla logo or something like that, because it's ugly as shit."
// It reads the switchboard (public.notify_since) every ten seconds and shows each new row as a card, top right on every screen, over everything including full screen.
// Its own window, not macOS Notification Center: nothing to allow, big enough to read from across the room, stays until it has been seen, always this logo.
// Level 1 = 20 s, silent · level 2 = 40 s, a soft sound · level 3 = 90 s, the louder sound, counted only while someone is at this Mac. The pointer on a card holds it. A click opens the story in the reader. The menu bar logo keeps the last ones.
// 1.6, 1 Nov. Alan: "I haven't been receiving notifications even on the computer for a while. I've not seen anything." They had shown, measured on both Macs: eight silent seconds and gone, whoever was or was not looking.
// So the clock now runs only while someone is at this Mac. Away, a card waits (3 minutes, 15, an hour by level) so a stack cannot sit on a screen for ever.
// No Dock icon, never takes focus. Secrets live in ~/Library/Application Support/Scintilla/config.json (600), never in this file.
// 1.1, same day. Alan: "it is like pretty big. Can you kind of keep things sized to about what the notification center looks like?" The card is now the size of a macOS banner, on every screen.
// "I clicked on a news story. It takes me to the article in Google Chrome. Is there any way for it to happen inside of the app? ... that I can close easily ... I'm going to leave a scatter of links":
// a click opens the story in one reader window of our own, floating, closed by Esc or the X. It never takes the stage from what he is doing, and it holds one story at a time.
import AppKit
import WebKit
import CoreGraphics

let VERSION = "1.6"
let INK = NSColor(srgbRed: 0.91, green: 0.92, blue: 0.96, alpha: 1), DIM = NSColor(srgbRed: 0.60, green: 0.62, blue: 0.72, alpha: 1)
let CYAN = NSColor(srgbRed: 0, green: 0.83, blue: 1, alpha: 1), AMBER = NSColor(srgbRed: 0.98, green: 0.70, blue: 0.10, alpha: 1)
let BULL = NSColor(srgbRed: 0, green: 1, blue: 0.64, alpha: 1), BEAR = NSColor(srgbRed: 1, green: 0.27, blue: 0.42, alpha: 1)
let PANEL = NSColor(srgbRed: 0.04, green: 0.04, blue: 0.06, alpha: 0.97), EDGE = NSColor(srgbRed: 0.21, green: 0.21, blue: 0.31, alpha: 1)

struct Item: Decodable { let id: Int64; let age_s: Int; let level: Int; let kind: String; let ticker: String?; let title: String; let body: String?; let source: String?; let url: String?; let pct: Double? }
struct Config: Decodable { let url: String; let anon: String; let token: String }

// The trefoil, from icon.svg: three arcs and a centre dot, drawn so it is crisp at any size
func trefoil(_ size: CGFloat, color: NSColor, tile: Bool, template: Bool = false) -> NSImage {
  let img = NSImage(size: NSSize(width: size, height: size), flipped: true) { rect in
    guard let c = NSGraphicsContext.current?.cgContext else { return false }
    let s = size / 96; c.scaleBy(x: s, y: s)
    if !tile && !template { c.translateBy(x: 48, y: 48); c.scaleBy(x: 1.45, y: 1.45); c.translateBy(x: -48, y: -48) }   // the mark alone fills its box
    if tile { c.setFillColor(NSColor(srgbRed: 0.04, green: 0.04, blue: 0.06, alpha: 1).cgColor); c.addPath(CGPath(roundedRect: CGRect(x: 0, y: 0, width: 96, height: 96), cornerWidth: 20, cornerHeight: 20, transform: nil)); c.fillPath() }
    c.setFillColor(color.cgColor); c.fillEllipse(in: CGRect(x: 44, y: 44, width: 8, height: 8))
    c.setLineWidth(template ? 7 : 5); c.setLineCap(.round)
    for (i, op) in [(0, 1.0), (1, 0.85), (2, 0.7)] {
      c.saveGState(); c.translateBy(x: 48, y: 48); c.rotate(by: CGFloat(i) * 2 * .pi / 3); c.translateBy(x: -48, y: -48)
      c.setStrokeColor(color.withAlphaComponent(template ? 1 : op).cgColor)
      c.addArc(center: CGPoint(x: 48, y: 43.42), radius: 22, startAngle: atan2(-15.62, -15.5), endAngle: atan2(-15.62, 15.5), clockwise: false); c.strokePath(); c.restoreGState()
    }
    return true
  }
  img.isTemplate = template
  return img
}

final class CardPanel: NSPanel { override var canBecomeKey: Bool { false }; override var canBecomeMain: Bool { false } }
final class ClearLabel: NSTextField { override func hitTest(_ point: NSPoint) -> NSView? { nil } }
func label(_ s: String, _ font: NSFont, _ color: NSColor, lines: Int = 1) -> ClearLabel {
  let l = ClearLabel(labelWithString: s); l.font = font; l.textColor = color; l.maximumNumberOfLines = lines
  l.lineBreakMode = lines == 1 ? .byTruncatingTail : .byWordWrapping; l.cell?.wraps = lines > 1; l.cell?.isScrollable = false; l.cell?.truncatesLastVisibleLine = true; l.drawsBackground = false
  return l
}
func ageText(_ s: Int) -> String { s < 60 ? "now" : s < 3600 ? "\(s / 60)m" : s < 86400 ? "\(s / 3600)h" : "\(s / 86400)d" }

// One card's picture. Height follows the text, up to three lines of headline.
final class CardView: NSView {
  let item: Item; let scale: CGFloat
  var onClick: (() -> Void)?; var onClose: (() -> Void)?; var onHover: ((Bool) -> Void)?
  private let close = NSButton()
  private(set) var wantedHeight: CGFloat = 0
  init(item: Item, width: CGFloat, scale: CGFloat) {
    self.item = item; self.scale = scale
    super.init(frame: NSRect(x: 0, y: 0, width: width, height: 100))
    wantsLayer = true; layer?.backgroundColor = PANEL.cgColor; layer?.cornerRadius = 13; layer?.borderWidth = 1; layer?.borderColor = EDGE.cgColor; layer?.masksToBounds = true
    let accent = item.level >= 3 ? AMBER : item.level == 2 ? CYAN : EDGE
    let pad: CGFloat = 10, logoSize: CGFloat = 30
    // no coloured stripe down the left edge. Alan, 1 Nov: "I have never liked these things where you put the cyan thing on the left side ... I fucking hate it". The name's colour says the level.
    // 1 Nov. Alan: "the weather alerts ... all of those things are going to go to the scintilla? Because that's not the idea." Weather and the Macs' restart warning are not Scintilla: no logo, their own mark and name.
    // 1 Nov: "those Urth ones should be Urth branded". Each family has its own mark and name.
    let isVolume = item.source == "Volume Pulse" || (item.title.range(of: #"^(scintilla\s*·\s*)?volume\b"#, options: [.regularExpression, .caseInsensitive]) != nil)
    let isUrth = item.kind == "urth", notScintilla = isUrth || item.kind == "system" || isVolume
    let urthImage = Bundle.main.image(forResource: "urth")
    let logo = NSImageView(image: isUrth ? (urthImage ?? NSImage()) : notScintilla ? (NSImage(systemSymbolName: isVolume ? "waveform.path.ecg" : "desktopcomputer", accessibilityDescription: nil) ?? NSImage()) : trefoil(logoSize, color: CYAN, tile: false)); logo.imageScaling = .scaleProportionallyUpOrDown; logo.contentTintColor = isVolume ? CYAN : DIM; logo.symbolConfiguration = .init(pointSize: 22, weight: .regular); logo.wantsLayer = true; if isUrth { logo.layer?.cornerRadius = 7; logo.layer?.masksToBounds = true }; addSubview(logo)
    let textX = pad + logoSize + 9, textW = width - textX - pad
    // the top line: name, the day's move, then where it came from and how old
    let urthGreen = NSColor(srgbRed: 0.55, green: 0.80, blue: 0.62, alpha: 1)
    let who = label((isUrth ? "URTH" : item.kind == "system" ? "THIS MAC" : isVolume ? "VOLUME" : item.ticker ?? (item.level >= 3 ? "SCINTILLA" : "MARKET")), .monospacedSystemFont(ofSize: 12, weight: .bold), isUrth ? urthGreen : isVolume ? CYAN : notScintilla ? DIM : accent == EDGE ? CYAN : accent)
    who.sizeToFit(); addSubview(who)
    var pctLabel: ClearLabel? = nil
    if let p = item.pct { let t = (p >= 0 ? "+" : "") + String(format: "%.1f%%", p); let l = label(t, .monospacedSystemFont(ofSize: 11.5, weight: .semibold), p >= 0 ? BULL : BEAR); l.sizeToFit(); addSubview(l); pctLabel = l }
    let meta = [item.source, ageText(item.age_s)].compactMap { ($0 ?? "").isEmpty ? nil : $0 }.joined(separator: " · ")
    let metaL = label(meta, .systemFont(ofSize: 10.5), DIM); metaL.alignment = .right; addSubview(metaL)
    let head = label(item.title, .systemFont(ofSize: 13, weight: .medium), INK, lines: 3); addSubview(head)
    let headH = head.cell!.cellSize(forBounds: NSRect(x: 0, y: 0, width: textW, height: 400)).height
    var bodyL: ClearLabel? = nil; var bodyH: CGFloat = 0
    if let b = item.body, !b.isEmpty { let l = label(b, .systemFont(ofSize: 12), DIM, lines: 2); addSubview(l); bodyL = l; bodyH = l.cell!.cellSize(forBounds: NSRect(x: 0, y: 0, width: textW, height: 400)).height + 1 }
    let topLineH: CGFloat = 16
    wantedHeight = max(logoSize + 2 * pad, pad + topLineH + 2 + headH + bodyH + pad - 1)
    let h = wantedHeight
    setFrameSize(NSSize(width: width, height: h))
    logo.frame = NSRect(x: pad, y: h - pad - logoSize, width: logoSize, height: logoSize)
    let topY = h - pad - topLineH + 1
    who.frame = NSRect(x: textX, y: topY, width: min(who.frame.width + 2, textW * 0.6), height: topLineH)
    var usedX = textX + who.frame.width + 6
    if let l = pctLabel { l.frame = NSRect(x: usedX, y: topY, width: l.frame.width + 2, height: topLineH); usedX += l.frame.width + 6 }
    metaL.frame = NSRect(x: usedX, y: topY - 1, width: max(0, textX + textW - usedX - 14), height: topLineH)
    head.frame = NSRect(x: textX, y: topY - 2 - headH, width: textW, height: headH)
    bodyL?.frame = NSRect(x: textX, y: topY - 3 - headH - bodyH + 1, width: textW, height: bodyH)
    close.title = "×"; close.isBordered = false; close.font = .systemFont(ofSize: 13); close.contentTintColor = DIM; close.target = self; close.action = #selector(closeTapped); close.isHidden = true
    close.frame = NSRect(x: width - 19, y: h - 20, width: 16, height: 16); addSubview(close)
    addTrackingArea(NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self, userInfo: nil))
  }
  required init?(coder: NSCoder) { fatalError() }
  override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
  override func mouseEntered(with event: NSEvent) { close.isHidden = false; layer?.borderColor = CYAN.cgColor; onHover?(true) }
  override func mouseExited(with event: NSEvent) { close.isHidden = true; layer?.borderColor = EDGE.cgColor; onHover?(false) }
  override func mouseUp(with event: NSEvent) { onClick?() }
  @objc func closeTapped() { onClose?() }
}

// ---- the reader: one floating window, one story at a time, closed by Esc or the X ----
final class ReaderPanel: NSPanel {
  override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { false }
  override func cancelOperation(_ sender: Any?) { Reader.shared.close() }
}
final class ReaderHeader: NSView { override var mouseDownCanMoveWindow: Bool { true } }
final class Reader: NSObject, WKNavigationDelegate, WKUIDelegate, NSWindowDelegate {
  static let shared = Reader()
  var panel: ReaderPanel?; var web: WKWebView?; var titleL: ClearLabel?; var current: URL?; var keepB: NSButton?
  var onLoaded: (() -> Void)?
  private var keys: Any?
  func open(_ url: URL, title: String, offscreen: Bool = false) {
    current = url
    if panel == nil { build(offscreen: offscreen) }
    titleL?.stringValue = title
    web?.load(URLRequest(url: url))
    panel?.makeKeyAndOrderFront(nil)   // a floating panel that never activates the app: Stage Manager keeps his stage, Esc still reaches it
  }
  private func build(offscreen: Bool) {
    let mouse = NSEvent.mouseLocation, sc = NSScreen.screens.first { $0.frame.contains(mouse) } ?? NSScreen.main ?? NSScreen.screens[0], vf = sc.visibleFrame
    let w = min(1000, vf.width * 0.72), h = vf.height * 0.88
    let rect = offscreen ? NSRect(x: -6000, y: 200, width: w, height: h) : NSRect(x: vf.midX - w / 2, y: vf.midY - h / 2, width: w, height: h)
    let p = ReaderPanel(contentRect: rect, styleMask: [.titled, .closable, .resizable, .nonactivatingPanel, .fullSizeContentView], backing: .buffered, defer: false)
    p.titleVisibility = .hidden; p.titlebarAppearsTransparent = true; p.level = .floating; p.hidesOnDeactivate = false; p.isReleasedWhenClosed = false; p.delegate = self; p.minSize = NSSize(width: 420, height: 320)
    p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .auxiliary, .ignoresCycle]; p.backgroundColor = NSColor(srgbRed: 0.04, green: 0.04, blue: 0.06, alpha: 1); p.animationBehavior = .none
    let root = NSView(frame: NSRect(origin: .zero, size: rect.size)); root.autoresizingMask = [.width, .height]; p.contentView = root
    let headH: CGFloat = 36
    let head = ReaderHeader(frame: NSRect(x: 0, y: rect.height - headH, width: rect.width, height: headH)); head.autoresizingMask = [.width, .minYMargin]; head.wantsLayer = true; head.layer?.backgroundColor = NSColor(srgbRed: 0.04, green: 0.04, blue: 0.06, alpha: 1).cgColor; root.addSubview(head)
    let logo = NSImageView(image: trefoil(22, color: CYAN, tile: false)); logo.frame = NSRect(x: 76, y: 7, width: 22, height: 22); head.addSubview(logo)
    let t = label("", .systemFont(ofSize: 12.5, weight: .medium), DIM); t.frame = NSRect(x: 104, y: 9, width: rect.width - 104 - 262, height: 18); t.autoresizingMask = [.width]; head.addSubview(t); titleL = t
    let closeB = NSButton(title: "Close  esc", target: self, action: #selector(closeTapped)); closeB.bezelStyle = .rounded; closeB.frame = NSRect(x: rect.width - 88, y: 5, width: 82, height: 26); closeB.autoresizingMask = [.minXMargin]; head.addSubview(closeB)
    let out = NSButton(title: "Browser ↗", target: self, action: #selector(toBrowser)); out.bezelStyle = .rounded; out.frame = NSRect(x: rect.width - 178, y: 5, width: 86, height: 26); out.autoresizingMask = [.minXMargin]; head.addSubview(out)
    // Alan: "a method by which I have ... I see a story and I push it to you guys or the system, and it's ingested"
    let keep = NSButton(title: "★ Keep", target: self, action: #selector(keepTapped)); keep.bezelStyle = .rounded; keep.frame = NSRect(x: rect.width - 252, y: 5, width: 70, height: 26); keep.autoresizingMask = [.minXMargin]; head.addSubview(keep); keepB = keep
    let cfg = WKWebViewConfiguration(); cfg.websiteDataStore = .default()   // a site he signs in to here stays signed in
    let v = WKWebView(frame: NSRect(x: 0, y: 0, width: rect.width, height: rect.height - headH), configuration: cfg); v.autoresizingMask = [.width, .height]; v.navigationDelegate = self; v.uiDelegate = self; v.allowsBackForwardNavigationGestures = true
    v.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"; root.addSubview(v)
    panel = p; web = v
    keys = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] e in if e.keyCode == 53 { self?.close(); return nil }; return e }
  }
  @objc func closeTapped() { close() }
  @objc func keepTapped() { if let u = web?.url ?? current { keepLink(u.absoluteString, title: web?.title); keepB?.title = "★ Kept"; keepB?.isEnabled = false } }
  @objc func toBrowser() { if let u = web?.url ?? current { NSWorkspace.shared.open(u) }; close() }
  func close() { panel?.close() }
  func windowWillClose(_ n: Notification) { web?.stopLoading(); web?.navigationDelegate = nil; web?.uiDelegate = nil; web?.removeFromSuperview(); web = nil; panel = nil; titleL = nil; if let k = keys { NSEvent.removeMonitor(k); keys = nil } }   // nothing stays in memory after a story
  func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? { if a.targetFrame == nil { w.load(a.request) }; return nil }   // a link that wants a new window stays in this one
  func webView(_ w: WKWebView, didFinish n: WKNavigation!) { onLoaded?(); onLoaded = nil }
}

// ---- real X on the Station's X column. Alan, 29 Oct: "manual scroll no extension ... reload, refresh and scroll and yes change between lists ... if we can put my For You and the lists I have, that would be great, just like my X basically in Station".
// 1 Nov: "what ended up happening with that thing ... X-panel in the station instead of the one that auto-scrolled?" x.com refuses to load inside any web page (X-Frame-Options), so the Station cannot hold it. This app can: a window of its own, signed in once, sitting exactly on the column.
// The Station says where the column is and whether it can be seen (a playing video or charts-only covers it), a broadcast on the realtime channel station-x, about a tenth of a second (deck/index.html, xColumnSignal). Twice a second this app looks at the window list: anything else in front of the column and the panel steps away. It never takes focus from the Station.
let STATION_OWNER = "SCINTILLA Station"
final class XPanel: NSPanel { override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { false } }
final class XColumn: NSObject, WKNavigationDelegate, WKUIDelegate {
  static let shared = XColumn()
  var on: Bool { get { UserDefaults.standard.object(forKey: "xColumn") as? Bool ?? true } set { UserDefaults.standard.set(newValue, forKey: "xColumn"); tick() } }
  private var textScale: Double { get { let v = UserDefaults.standard.double(forKey: "xScale"); return v > 0 ? v : 1 } set { UserDefaults.standard.set(newValue, forKey: "xScale") } }
  private var cfg: Config?; private var socket: URLSessionWebSocketTask?; private var panel: XPanel?; private var web: WKWebView?; private var popup: NSPanel?; private var shown = false; private var lastW: CGFloat = 0
  private struct Want { let show: Bool; let x, y, w, h, iw, ih: Double }
  private var want: Want?
  func start(_ c: Config) { cfg = c; connect(); Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in self?.tick() }; Timer.scheduledTimer(withTimeInterval: 25, repeats: true) { [weak self] _ in self?.send(["topic": "phoenix", "event": "heartbeat", "payload": [String: Any](), "ref": "h"]) } }
  // the channel
  private func connect() {
    guard let c = cfg, let u = URL(string: c.url.replacingOccurrences(of: "https://", with: "wss://") + "/realtime/v1/websocket?apikey=" + c.anon + "&vsn=1.0.0") else { return }
    let t = URLSession.shared.webSocketTask(with: u); socket = t; t.resume()
    send(["topic": "realtime:station-x", "event": "phx_join", "payload": ["config": ["broadcast": ["self": false], "presence": ["key": ""], "postgres_changes": [Any](), "private": false] as [String: Any], "access_token": c.anon] as [String: Any], "ref": "1", "join_ref": "1"])
    listen(t)
  }
  private func send(_ o: [String: Any]) { guard let t = socket, let d = try? JSONSerialization.data(withJSONObject: o), let s = String(data: d, encoding: .utf8) else { return }; t.send(.string(s)) { [weak self] e in if e != nil { DispatchQueue.main.async { self?.lost(t) } } } }
  private func lost(_ t: URLSessionWebSocketTask) { guard socket === t else { return }; socket = nil; t.cancel(); DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in self?.connect() } }
  private func listen(_ t: URLSessionWebSocketTask) {
    t.receive { [weak self] r in DispatchQueue.main.async {
      guard let self = self, self.socket === t else { return }
      switch r {
      case .failure: self.lost(t)
      case .success(let m):
        if case .string(let s) = m, let d = s.data(using: .utf8), let o = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any], o["event"] as? String == "broadcast", let p = o["payload"] as? [String: Any], let q = p["payload"] as? [String: Any] { self.heard(q) }
        self.listen(t)
      }
    } }
  }
  // both Macs hear every Station; this one takes only what fits its own Station window
  private func heard(_ q: [String: Any]) {
    func n(_ k: String) -> Double { (q[k] as? NSNumber)?.doubleValue ?? 0 }
    let w = Want(show: q["show"] as? Bool ?? false, x: n("x"), y: n("y"), w: n("w"), h: n("h"), iw: n("iw"), ih: n("ih"))
    if stationWindow(iw: w.iw, ih: w.ih, onScreenOnly: false) != nil { want = w; tick() }
  }
  private func windows(onScreenOnly: Bool) -> [[String: Any]] { (CGWindowListCopyWindowInfo(onScreenOnly ? [.optionOnScreenOnly, .excludeDesktopElements] : [.optionAll], kCGNullWindowID) as? [[String: Any]]) ?? [] }
  private func bounds(_ w: [String: Any]) -> CGRect { var r = CGRect.zero; if let b = w[kCGWindowBounds as String] { CGRectMakeWithDictionaryRepresentation(b as! CFDictionary, &r) }; return r }
  private func stationWindow(iw: Double, ih: Double, onScreenOnly: Bool) -> CGRect? {
    var best: CGRect? = nil
    for w in windows(onScreenOnly: onScreenOnly) where (w[kCGWindowOwnerName as String] as? String) == STATION_OWNER && (w[kCGWindowLayer as String] as? Int) == 0 {
      let b = bounds(w); if abs(b.width - CGFloat(iw)) <= 3, b.height - CGFloat(ih) >= -3, b.height - CGFloat(ih) <= 90, b.width * b.height > (best.map { $0.width * $0.height } ?? 0) { best = b }
    }
    return best
  }
  func tick() {
    guard on, let r = want, r.show, let st = stationWindow(iw: r.iw, ih: r.ih, onScreenOnly: true) else { hide(); return }
    let rect = CGRect(x: st.minX + CGFloat(r.x), y: st.minY + (st.height - CGFloat(r.ih)) + CGFloat(r.y), width: CGFloat(r.w), height: CGFloat(r.h)), me = Int(getpid())
    for w in windows(onScreenOnly: true) {
      guard (w[kCGWindowLayer as String] as? Int) == 0, (w[kCGWindowOwnerPID as String] as? Int) != me else { continue }
      let owner = w[kCGWindowOwnerName as String] as? String ?? ""
      if owner == "WindowManager" || owner == "Window Server" || owner == "Wallpaper" { continue }
      guard bounds(w).intersects(rect.insetBy(dx: 2, dy: 2)) else { continue }
      if owner == STATION_OWNER { show(rect) } else { hide() }
      return
    }
    hide()
  }
  private func hide() { if shown { panel?.orderOut(nil); shown = false } }
  private func show(_ rect: CGRect) {
    if panel == nil { build() }
    guard let p = panel else { return }
    let H = NSScreen.screens[0].frame.height, f = NSRect(x: rect.minX, y: H - rect.maxY, width: rect.width, height: rect.height)
    if p.frame != f { p.setFrame(f, display: true) }
    if rect.width != lastW { lastW = rect.width; applyZoom() }
    if !shown { p.orderFrontRegardless(); shown = true }
  }
  private func applyZoom() { web?.pageZoom = CGFloat(min(1, max(0.5, Double(lastW) / 380)) * textScale) }   // X's phone-width layout starts near 380 wide; the column is narrower than that on most screens
  private func build() {
    let p = XPanel(contentRect: NSRect(x: 0, y: 0, width: 240, height: 600), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    p.level = .floating; p.hidesOnDeactivate = false; p.isReleasedWhenClosed = false; p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]; p.backgroundColor = NSColor(srgbRed: 0.04, green: 0.04, blue: 0.06, alpha: 1); p.animationBehavior = .none; p.hasShadow = false
    let root = NSView(frame: NSRect(x: 0, y: 0, width: 240, height: 600)); root.autoresizingMask = [.width, .height]; p.contentView = root
    let headH: CGFloat = 20
    let head = NSView(frame: NSRect(x: 0, y: 600 - headH, width: 240, height: headH)); head.autoresizingMask = [.width, .minYMargin]; head.wantsLayer = true; head.layer?.backgroundColor = NSColor(srgbRed: 0.04, green: 0.04, blue: 0.06, alpha: 1).cgColor; root.addSubview(head)
    var bx: CGFloat = 4
    for (title, tip, sel) in [("⌂", "For You", #selector(goHome)), ("≡", "Your lists", #selector(goLists)), ("↻", "Refresh", #selector(refresh)), ("–", "Smaller", #selector(smaller)), ("+", "Bigger", #selector(bigger))] as [(String, String, Selector)] {
      let b = NSButton(title: title, target: self, action: sel); b.isBordered = false; b.font = .systemFont(ofSize: 13); b.contentTintColor = DIM; b.toolTip = tip; b.frame = NSRect(x: bx, y: 1, width: 24, height: 18); head.addSubview(b); bx += 26
    }
    let c = WKWebViewConfiguration(); c.websiteDataStore = .default(); c.mediaTypesRequiringUserActionForPlayback = .all
    let v = WKWebView(frame: NSRect(x: 0, y: 0, width: 240, height: 600 - headH), configuration: c); v.autoresizingMask = [.width, .height]; v.navigationDelegate = self; v.uiDelegate = self; v.allowsBackForwardNavigationGestures = true; v.underPageBackgroundColor = NSColor(srgbRed: 0.04, green: 0.04, blue: 0.06, alpha: 1)
    v.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"; root.addSubview(v)
    panel = p; web = v; v.load(URLRequest(url: URL(string: "https://x.com/home")!))
  }
  @objc private func goHome() { web?.load(URLRequest(url: URL(string: "https://x.com/home")!)) }
  @objc private func goLists() { if let u = web?.url, let name = u.path.split(separator: "/").first, !["home", "i", "search", "explore", "notifications", "messages"].contains(String(name)) { web?.load(URLRequest(url: URL(string: "https://x.com/" + name + "/lists")!)) } else { web?.load(URLRequest(url: URL(string: "https://x.com/i/lists")!)) } }
  @objc private func refresh() { web?.reload() }
  @objc private func smaller() { textScale = max(0.6, textScale - 0.08); applyZoom() }
  @objc private func bigger() { textScale = min(1.6, textScale + 0.08); applyZoom() }
  private func isX(_ u: URL) -> Bool { let h = (u.host ?? "").lowercased(); return h == "x.com" || h.hasSuffix(".x.com") || h == "twitter.com" || h.hasSuffix(".twitter.com") }
  private func isSignIn(_ u: URL) -> Bool { let h = (u.host ?? "").lowercased(); return h.hasSuffix("google.com") || h.hasSuffix("apple.com") || h.hasSuffix("gstatic.com") }
  // a link out of X opens in the reader, so the column stays on X
  func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    if a.navigationType == .linkActivated, let u = a.request.url, !isX(u), !isSignIn(u) { Reader.shared.open(u, title: u.host ?? "X"); decisionHandler(.cancel); return }
    decisionHandler(.allow)
  }
  func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? {
    guard let u = a.request.url else { return nil }
    if isSignIn(u) {   // "Sign in with Google" needs a real little window that can talk back
      let p = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 500, height: 660), styleMask: [.titled, .closable, .nonactivatingPanel], backing: .buffered, defer: false); p.level = .floating; p.center(); p.isReleasedWhenClosed = false
      let v = WKWebView(frame: p.contentView!.bounds, configuration: c); v.autoresizingMask = [.width, .height]; v.uiDelegate = self; v.customUserAgent = w.customUserAgent; p.contentView!.addSubview(v); p.makeKeyAndOrderFront(nil); popup = p; return v
    }
    if isX(u) { w.load(a.request) } else { Reader.shared.open(u, title: u.host ?? "X") }
    return nil
  }
  func webViewDidClose(_ w: WKWebView) { if w !== web { popup?.close(); popup = nil } }
}

// a link into the brain: the worker reads it on its next pass (a video gets a full read, a story a note)
func keepLink(_ url: String, title: String?) {
  let path = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Scintilla/config.json")
  guard let c = (try? Data(contentsOf: path)).flatMap({ try? JSONDecoder().decode(Config.self, from: $0) }), let u = URL(string: c.url + "/rest/v1/rpc/brain_keep") else { return }
  var r = URLRequest(url: u, timeoutInterval: 20); r.httpMethod = "POST"; r.setValue(c.anon, forHTTPHeaderField: "apikey"); r.setValue("Bearer " + c.anon, forHTTPHeaderField: "Authorization"); r.setValue("application/json", forHTTPHeaderField: "Content-Type")
  r.httpBody = try? JSONSerialization.data(withJSONObject: ["p_url": url, "p_title": title ?? "", "p_device": Host.current().localizedName ?? "Mac"])
  URLSession.shared.dataTask(with: r).resume()
}

// One notification, on every screen
final class Card {
  let item: Item; var panels: [(NSScreen, CardPanel, CardView)] = []; var left: Int; var waited = 0; let maxWait: Int; var hovered = false
  init(item: Item) { self.item = item; left = item.level >= 3 ? 90 : item.level == 2 ? 40 : 20; maxWait = item.level >= 3 ? 3600 : item.level == 2 ? 900 : 180 }
}

final class App: NSObject, NSApplicationDelegate, NSMenuDelegate {
  var cfg: Config?; var status: NSStatusItem!; var lastId: Int64 = 0; var cards: [Card] = []; var recent: [Item] = []; var booted = false; var busy = false
  var pausedUntil: Date? { get { UserDefaults.standard.object(forKey: "pausedUntil") as? Date } set { UserDefaults.standard.set(newValue, forKey: "pausedUntil") } }
  var minLevel: Int { get { max(1, UserDefaults.standard.integer(forKey: "minLevel")) } set { UserDefaults.standard.set(newValue, forKey: "minLevel") } }
  let maxOnScreen = 4, showIfYoungerThan = 900
  var lastOK = Date()

  func applicationDidFinishLaunching(_ n: Notification) {
    status = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    status.button?.image = trefoil(18, color: .black, tile: false, template: true); status.button?.toolTip = "SCINTILLA notifications"
    let m = NSMenu(); m.delegate = self; status.menu = m
    let url = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Scintilla/config.json")
    cfg = (try? Data(contentsOf: url)).flatMap { try? JSONDecoder().decode(Config.self, from: $0) }
    lastId = Int64(UserDefaults.standard.integer(forKey: "lastId"))
    Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in self?.poll() }
    Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.tickCards() }
    poll()
    if let c = cfg { XColumn.shared.start(c) }
    NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in self?.rebuildPanels() }
  }

  // ---- reading the switchboard ----
  func poll() {
    guard let c = cfg, !busy, let u = URL(string: c.url + "/rest/v1/rpc/notify_since") else { return }
    busy = true
    var r = URLRequest(url: u, timeoutInterval: 20); r.httpMethod = "POST"
    r.setValue(c.anon, forHTTPHeaderField: "apikey"); r.setValue("Bearer " + c.anon, forHTTPHeaderField: "Authorization"); r.setValue("application/json", forHTTPHeaderField: "Content-Type")
    r.httpBody = try? JSONSerialization.data(withJSONObject: ["p_token": c.token, "p_after": lastId, "p_limit": lastId == 0 ? 20 : 60, "p_version": VERSION])
    URLSession.shared.dataTask(with: r) { [weak self] data, resp, err in
      let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
      let items = code == 200 ? data.flatMap { try? JSONDecoder().decode([Item].self, from: $0) } : nil
      DispatchQueue.main.async { self?.busy = false; self?.heard(items) }
    }.resume()
  }
  func heard(_ items: [Item]?) {
    guard let items = items else { status.button?.alphaValue = Date().timeIntervalSince(lastOK) > 300 ? 0.35 : 1; return }
    lastOK = Date(); status.button?.alphaValue = 1
    for it in items {
      lastId = max(lastId, it.id)
      recent.insert(it, at: 0)
      // a Mac that slept does not get a flood: only what is fresh becomes a card; the rest waits in the menu
      if booted, it.age_s <= showIfYoungerThan, it.level >= minLevel, !(pausedUntil.map { $0 > Date() } ?? false) { show(it) }
    }
    if recent.count > 40 { recent.removeLast(recent.count - 40) }
    UserDefaults.standard.set(Int(lastId), forKey: "lastId")
    booted = true
  }

  // ---- the cards ----
  func nightNow() -> Bool { var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "America/New_York")!; let c = cal.dateComponents([.hour, .minute], from: Date()); let m = (c.hour ?? 12) * 60 + (c.minute ?? 0); return m >= 22 * 60 || m < 6 * 60 + 30 }
  func show(_ it: Item) {
    if !nightNow() { if it.level >= 3 { NSSound(named: "Glass")?.play() } else if it.level == 2 { let s = NSSound(named: "Tink"); s?.volume = 0.5; s?.play() } }
    let card = Card(item: it); cards.insert(card, at: 0); build(card)
    while cards.count > maxOnScreen { drop(cards.last!) }
    layout(animated: true)
  }
  // the cards' clock: it runs while someone is at this Mac, and a card waits while nobody is
  func awayFromThisMac() -> Bool { CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: CGEventType(rawValue: ~0)!) > 45 }
  func tickCards() {
    if cards.isEmpty { return }
    let away = awayFromThisMac(); var changed = false
    for card in cards where !card.hovered {
      if away { card.waited += 1; if card.waited >= card.maxWait { drop(card); changed = true } }
      else { card.left -= 1; if card.left <= 0 { drop(card); changed = true } }
    }
    if changed { layout(animated: true) }
  }
  func build(_ card: Card) {
    for sc in NSScreen.screens {
      let width: CGFloat = 360
      let v = CardView(item: card.item, width: width, scale: 1)
      let p = CardPanel(contentRect: NSRect(x: sc.visibleFrame.maxX + 10, y: sc.visibleFrame.maxY - v.wantedHeight, width: width, height: v.wantedHeight), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
      p.level = .statusBar; p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]; p.hidesOnDeactivate = false; p.isOpaque = false; p.backgroundColor = .clear; p.hasShadow = true; p.isMovable = false; p.animationBehavior = .none; p.contentView = v
      v.onClick = { [weak self, weak card] in guard let self = self, let card = card else { return }; if let s = card.item.url, let u = URL(string: s) { Reader.shared.open(u, title: [card.item.ticker, card.item.source].compactMap { $0 }.joined(separator: " · ")) }; self.drop(card); self.layout(animated: true) }
      v.onClose = { [weak self, weak card] in guard let self = self, let card = card else { return }; self.drop(card); self.layout(animated: true) }
      v.onHover = { [weak card] on in guard let card = card else { return }; card.hovered = on; if !on { card.left = max(card.left, 5) } }
      p.orderFrontRegardless(); card.panels.append((sc, p, v))
    }
  }
  func drop(_ card: Card) { for (_, p, _) in card.panels { p.orderOut(nil); p.close() }; card.panels = []; cards.removeAll { $0 === card } }
  func layout(animated: Bool) {
    for sc in NSScreen.screens {
      let vf = sc.visibleFrame; var y = vf.maxY - 8
      for card in cards { guard let e = card.panels.first(where: { $0.0 == sc }) else { continue }
        let h = e.2.wantedHeight, w = e.2.frame.width; y -= h
        let f = NSRect(x: vf.maxX - w - 8, y: y, width: w, height: h); y -= 6
        if animated { NSAnimationContext.runAnimationGroup { $0.duration = 0.16; e.1.animator().setFrame(f, display: true) } } else { e.1.setFrame(f, display: true) }
      }
    }
  }
  func rebuildPanels() { for c in cards { for (_, p, _) in c.panels { p.orderOut(nil); p.close() }; c.panels = []; build(c) }; layout(animated: false) }

  // ---- the menu bar logo ----
  func menuNeedsUpdate(_ menu: NSMenu) {
    menu.removeAllItems()
    let paused = pausedUntil.map { $0 > Date() } ?? false
    let head = NSMenuItem(title: paused ? "SCINTILLA · paused" : "SCINTILLA · on", action: nil, keyEquivalent: ""); head.isEnabled = false; menu.addItem(head)
    for it in recent.prefix(12) {
      let name = it.ticker.map { $0 + " · " } ?? ""; var t = name + it.title; if t.count > 76 { t = String(t.prefix(75)) + "…" }
      let mi = NSMenuItem(title: t, action: #selector(openRecent(_:)), keyEquivalent: ""); mi.target = self; mi.representedObject = it.url; mi.isEnabled = it.url != nil; menu.addItem(mi)
    }
    menu.addItem(.separator())
    for (t, lv) in [("Show everything", 1), ("Show my names and alerts", 2), ("Show alerts only", 3)] { let mi = NSMenuItem(title: t, action: #selector(setLevel(_:)), keyEquivalent: ""); mi.target = self; mi.tag = lv; mi.state = minLevel == lv ? .on : .off; menu.addItem(mi) }
    menu.addItem(.separator())
    let keep = NSMenuItem(title: "Keep the link I copied", action: #selector(keepCopied), keyEquivalent: ""); keep.target = self; menu.addItem(keep)
    let all = NSMenuItem(title: "See the last two days", action: #selector(seeAll), keyEquivalent: ""); all.target = self; menu.addItem(all)
    let pause = NSMenuItem(title: paused ? "Resume now" : "Pause for an hour", action: #selector(togglePause), keyEquivalent: ""); pause.target = self; menu.addItem(pause)
    let xc = NSMenuItem(title: "X on the Station's column", action: #selector(toggleX), keyEquivalent: ""); xc.target = self; xc.state = XColumn.shared.on ? .on : .off; menu.addItem(xc)
    let quit = NSMenuItem(title: "Quit until the next login", action: #selector(quit), keyEquivalent: ""); quit.target = self; menu.addItem(quit)
  }
  @objc func openRecent(_ s: NSMenuItem) { if let t = s.representedObject as? String, let u = URL(string: t) { Reader.shared.open(u, title: s.title) } }
  @objc func setLevel(_ s: NSMenuItem) { minLevel = s.tag }
  @objc func keepCopied() { if let t = NSPasteboard.general.string(forType: .string)?.trimmingCharacters(in: .whitespacesAndNewlines), t.lowercased().hasPrefix("http") { keepLink(t, title: nil) } }
  @objc func seeAll() { if let u = URL(string: "https://station.scintillahub.ai/notify/") { Reader.shared.open(u, title: "The last two days") } }
  @objc func togglePause() { pausedUntil = (pausedUntil.map { $0 > Date() } ?? false) ? nil : Date().addingTimeInterval(3600) }
  @objc func toggleX() { XColumn.shared.on.toggle() }
  @objc func quit() { NSApp.terminate(nil) }
}

// ---- for pictures: draw sample cards to a PNG with the app's own code ----
func renderSamples(_ path: String) {
  let samples: [Item] = [
    Item(id: 1, age_s: 20, level: 2, kind: "news", ticker: "MU", title: "Micron prices $3 billion of senior notes as memory contract prices keep rising", body: nil, source: "Reuters", url: nil, pct: -3.4),
    Item(id: 2, age_s: 50, level: 3, kind: "actual", ticker: "NVDA", title: "NVDA reported: EPS 1.24 vs 1.11 expected", body: "Beat by 11.7% · revenue 71.20B", source: "SCINTILLA", url: nil, pct: 4.2),
    Item(id: 5, age_s: 30, level: 2, kind: "urth", ticker: nil, title: "Rain Tuesday from 2 PM in Coral Gables: move the afternoon crews to morning", body: "0.6 in expected, wind 18 mph", source: "Urth weather", url: nil, pct: nil),
    Item(id: 6, age_s: 40, level: 2, kind: "news", ticker: "SNDK", title: "Sandisk downgraded to Hold from Buy at Rosenblatt", body: nil, source: "Ratings", url: nil, pct: nil),
    Item(id: 7, age_s: 45, level: 2, kind: "news", ticker: "AI READ", title: "Chips and AI infrastructure broke hard Friday while money rotated into energy, staples and utilities", body: nil, source: "Weekly", url: nil, pct: nil),
    Item(id: 3, age_s: 70, level: 1, kind: "macro", ticker: nil, title: "OPEC, Allies Keep Output Steady While Gulf Shipping Remains Under Threat", body: nil, source: "WSJ", url: nil, pct: nil),
    Item(id: 4, age_s: 95, level: 3, kind: "research", ticker: nil, title: "Catch-down gauge: stage 1 to 2", body: "S&P 3.3% off its closing high: the index is starting to follow.", source: "Research", url: nil, pct: nil),
  ]
  let width: CGFloat = 360, gap: CGFloat = 8
  let views = samples.map { CardView(item: $0, width: width, scale: 1) }
  let total = views.reduce(gap) { $0 + $1.wantedHeight + gap }
  let host = NSView(frame: NSRect(x: 0, y: 0, width: width + 2 * gap, height: total)); host.wantsLayer = true; host.layer?.backgroundColor = NSColor(srgbRed: 0.09, green: 0.1, blue: 0.14, alpha: 1).cgColor
  var y = total - gap; for v in views { y -= v.wantedHeight; v.setFrameOrigin(NSPoint(x: gap, y: y)); host.addSubview(v); y -= gap }
  guard let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { return }
  host.cacheDisplay(in: host.bounds, to: rep)
  try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
if CommandLine.arguments.count >= 3, CommandLine.arguments[1] == "--render" { renderSamples(CommandLine.arguments[2]); exit(0) }
// for tests: the reader alone, off the screen unless asked, for a set number of seconds
if CommandLine.arguments.count >= 3, CommandLine.arguments[1] == "--reader", let u = URL(string: CommandLine.arguments[2]) {
  let on = CommandLine.arguments.contains("--onscreen"), secs = Double(CommandLine.arguments.last ?? "") ?? 8
  DispatchQueue.main.async { Reader.shared.onLoaded = { print("loaded", Reader.shared.web?.url?.absoluteString.prefix(80) ?? "") }; Reader.shared.open(u, title: "TEST · reader", offscreen: !on); print("window", Reader.shared.panel?.windowNumber ?? 0) }
  DispatchQueue.main.asyncAfter(deadline: .now() + secs) { exit(0) }
  app.run()
}
let others = NSRunningApplication.runningApplications(withBundleIdentifier: Bundle.main.bundleIdentifier ?? "com.scintilla.notify").filter { $0 != NSRunningApplication.current }
if !others.isEmpty { exit(0) }
let delegate = App(); app.delegate = delegate; app.run()
