// Scintilla.app (1 Nov 2026, coordinator). The cards on each Mac. Alan: "I get so many, and then I feel like I don't see like a stream of notifications coming in on the
// computers. I need the notifications coming everywhere ... if we can make that have the Scintilla logo or something like that, because it's ugly as shit."
// It reads the switchboard (public.notify_since) every ten seconds and shows each new row as a card, top right on every screen, over everything including full screen.
// Its own window, not macOS Notification Center: nothing to allow, big enough to read from across the room, stays until it has been seen, always this logo.
// Level 1 = 8 s, silent · level 2 = 16 s, a soft sound · level 3 = 40 s, the louder sound. The pointer on a card holds it. A click opens the story. The menu bar logo keeps the last ones.
// No Dock icon, never takes focus. Secrets live in ~/Library/Application Support/Scintilla/config.json (600), never in this file.
import AppKit

let VERSION = "1.0"
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
    wantsLayer = true; layer?.backgroundColor = PANEL.cgColor; layer?.cornerRadius = 11 * scale; layer?.borderWidth = 1; layer?.borderColor = EDGE.cgColor
    let accent = item.level >= 3 ? AMBER : item.level == 2 ? CYAN : EDGE
    let pad = 13 * scale, logoSize = 40 * scale
    let bar = NSView(frame: .zero); bar.wantsLayer = true; bar.layer?.backgroundColor = accent.cgColor; addSubview(bar)
    let logo = NSImageView(image: trefoil(logoSize, color: CYAN, tile: false)); addSubview(logo)
    let textX = pad + logoSize + 10 * scale, textW = width - textX - pad
    // the top line: name, the day's move, then where it came from and how old
    let who = label((item.ticker ?? (item.level >= 3 ? "SCINTILLA" : "MARKET")), .monospacedSystemFont(ofSize: 15 * scale, weight: .bold), accent == EDGE ? CYAN : accent)
    who.sizeToFit(); addSubview(who)
    var pctLabel: ClearLabel? = nil
    if let p = item.pct { let t = (p >= 0 ? "+" : "") + String(format: "%.1f%%", p); let l = label(t, .monospacedSystemFont(ofSize: 14 * scale, weight: .semibold), p >= 0 ? BULL : BEAR); l.sizeToFit(); addSubview(l); pctLabel = l }
    let meta = [item.source, ageText(item.age_s)].compactMap { ($0 ?? "").isEmpty ? nil : $0 }.joined(separator: " · ")
    let metaL = label(meta, .systemFont(ofSize: 11.5 * scale), DIM); metaL.alignment = .right; addSubview(metaL)
    let head = label(item.title, .systemFont(ofSize: 16 * scale, weight: .medium), INK, lines: 3); addSubview(head)
    let headH = head.cell!.cellSize(forBounds: NSRect(x: 0, y: 0, width: textW, height: 400)).height
    var bodyL: ClearLabel? = nil; var bodyH: CGFloat = 0
    if let b = item.body, !b.isEmpty { let l = label(b, .systemFont(ofSize: 13 * scale), DIM, lines: 3); addSubview(l); bodyL = l; bodyH = l.cell!.cellSize(forBounds: NSRect(x: 0, y: 0, width: textW, height: 400)).height + 4 * scale }
    let topLineH = 20 * scale
    wantedHeight = max(logoSize + 2 * pad, pad + topLineH + 4 * scale + headH + bodyH + pad - 2 * scale)
    let h = wantedHeight
    setFrameSize(NSSize(width: width, height: h))
    bar.frame = NSRect(x: 0, y: 0, width: 4 * scale, height: h)
    logo.frame = NSRect(x: pad, y: h - pad - logoSize, width: logoSize, height: logoSize)
    let topY = h - pad - topLineH + 2 * scale
    who.frame = NSRect(x: textX, y: topY, width: min(who.frame.width + 2, textW * 0.6), height: topLineH)
    var usedX = textX + who.frame.width + 8 * scale
    if let l = pctLabel { l.frame = NSRect(x: usedX, y: topY, width: l.frame.width + 2, height: topLineH); usedX += l.frame.width + 8 * scale }
    metaL.frame = NSRect(x: usedX, y: topY - 1, width: max(0, textX + textW - usedX - 18 * scale), height: topLineH)
    head.frame = NSRect(x: textX, y: topY - 4 * scale - headH, width: textW, height: headH)
    bodyL?.frame = NSRect(x: textX, y: topY - 8 * scale - headH - bodyH + 4 * scale, width: textW, height: bodyH)
    close.title = "×"; close.isBordered = false; close.font = .systemFont(ofSize: 15 * scale); close.contentTintColor = DIM; close.target = self; close.action = #selector(closeTapped); close.isHidden = true
    close.frame = NSRect(x: width - 22 * scale, y: h - 24 * scale, width: 20 * scale, height: 20 * scale); addSubview(close)
    addTrackingArea(NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self, userInfo: nil))
  }
  required init?(coder: NSCoder) { fatalError() }
  override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
  override func mouseEntered(with event: NSEvent) { close.isHidden = false; layer?.borderColor = CYAN.cgColor; onHover?(true) }
  override func mouseExited(with event: NSEvent) { close.isHidden = true; layer?.borderColor = EDGE.cgColor; onHover?(false) }
  override func mouseUp(with event: NSEvent) { onClick?() }
  @objc func closeTapped() { onClose?() }
}

// One notification, on every screen
final class Card {
  let item: Item; var panels: [(NSScreen, CardPanel, CardView)] = []; var timer: Timer?; var left: TimeInterval
  init(item: Item) { self.item = item; left = item.level >= 3 ? 40 : item.level == 2 ? 16 : 8 }
}

final class App: NSObject, NSApplicationDelegate, NSMenuDelegate {
  var cfg: Config?; var status: NSStatusItem!; var lastId: Int64 = 0; var cards: [Card] = []; var recent: [Item] = []; var booted = false; var busy = false
  var pausedUntil: Date? { get { UserDefaults.standard.object(forKey: "pausedUntil") as? Date } set { UserDefaults.standard.set(newValue, forKey: "pausedUntil") } }
  var minLevel: Int { get { max(1, UserDefaults.standard.integer(forKey: "minLevel")) } set { UserDefaults.standard.set(newValue, forKey: "minLevel") } }
  let maxOnScreen = 5, showIfYoungerThan = 900
  var lastOK = Date()

  func applicationDidFinishLaunching(_ n: Notification) {
    status = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    status.button?.image = trefoil(18, color: .black, tile: false, template: true); status.button?.toolTip = "SCINTILLA notifications"
    let m = NSMenu(); m.delegate = self; status.menu = m
    let url = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Scintilla/config.json")
    cfg = (try? Data(contentsOf: url)).flatMap { try? JSONDecoder().decode(Config.self, from: $0) }
    lastId = Int64(UserDefaults.standard.integer(forKey: "lastId"))
    Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in self?.poll() }
    poll()
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
    layout(animated: true); arm(card)
  }
  func build(_ card: Card) {
    for sc in NSScreen.screens {
      let scale = min(1.5, max(1, sc.frame.width / 1600)), width = 440 * scale
      let v = CardView(item: card.item, width: width, scale: scale)
      let p = CardPanel(contentRect: NSRect(x: sc.visibleFrame.maxX + 10, y: sc.visibleFrame.maxY - v.wantedHeight, width: width, height: v.wantedHeight), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
      p.level = .statusBar; p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]; p.hidesOnDeactivate = false; p.isOpaque = false; p.backgroundColor = .clear; p.hasShadow = true; p.isMovable = false; p.animationBehavior = .none; p.contentView = v
      v.onClick = { [weak self, weak card] in guard let self = self, let card = card else { return }; if let s = card.item.url, let u = URL(string: s) { NSWorkspace.shared.open(u) }; self.drop(card); self.layout(animated: true) }
      v.onClose = { [weak self, weak card] in guard let self = self, let card = card else { return }; self.drop(card); self.layout(animated: true) }
      v.onHover = { [weak self, weak card] on in guard let self = self, let card = card else { return }; if on { card.timer?.invalidate() } else { card.left = max(card.left, 5); self.arm(card) } }
      p.orderFrontRegardless(); card.panels.append((sc, p, v))
    }
  }
  func arm(_ card: Card) { card.timer?.invalidate(); card.timer = Timer.scheduledTimer(withTimeInterval: card.left, repeats: false) { [weak self, weak card] _ in guard let self = self, let card = card else { return }; self.drop(card); self.layout(animated: true) } }
  func drop(_ card: Card) { card.timer?.invalidate(); for (_, p, _) in card.panels { p.orderOut(nil); p.close() }; card.panels = []; cards.removeAll { $0 === card } }
  func layout(animated: Bool) {
    for sc in NSScreen.screens {
      let vf = sc.visibleFrame; let scale = min(1.5, max(1, sc.frame.width / 1600)); var y = vf.maxY - 10 * scale
      for card in cards { guard let e = card.panels.first(where: { $0.0 == sc }) else { continue }
        let h = e.2.wantedHeight, w = e.2.frame.width; y -= h
        let f = NSRect(x: vf.maxX - w - 10 * scale, y: y, width: w, height: h); y -= 7 * scale
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
    let pause = NSMenuItem(title: paused ? "Resume now" : "Pause for an hour", action: #selector(togglePause), keyEquivalent: ""); pause.target = self; menu.addItem(pause)
    let quit = NSMenuItem(title: "Quit until the next login", action: #selector(quit), keyEquivalent: ""); quit.target = self; menu.addItem(quit)
  }
  @objc func openRecent(_ s: NSMenuItem) { if let t = s.representedObject as? String, let u = URL(string: t) { NSWorkspace.shared.open(u) } }
  @objc func setLevel(_ s: NSMenuItem) { minLevel = s.tag }
  @objc func togglePause() { pausedUntil = (pausedUntil.map { $0 > Date() } ?? false) ? nil : Date().addingTimeInterval(3600) }
  @objc func quit() { NSApp.terminate(nil) }
}

// ---- for pictures: draw sample cards to a PNG with the app's own code ----
func renderSamples(_ path: String) {
  let samples: [Item] = [
    Item(id: 1, age_s: 20, level: 2, kind: "news", ticker: "MU", title: "Micron prices $3 billion of senior notes as memory contract prices keep rising", body: nil, source: "Reuters", url: nil, pct: -3.4),
    Item(id: 2, age_s: 50, level: 3, kind: "actual", ticker: "NVDA", title: "NVDA reported: EPS 1.24 vs 1.11 expected", body: "Beat by 11.7% · revenue 71.20B", source: "SCINTILLA", url: nil, pct: 4.2),
    Item(id: 3, age_s: 70, level: 1, kind: "macro", ticker: nil, title: "OPEC, Allies Keep Output Steady While Gulf Shipping Remains Under Threat", body: nil, source: "WSJ", url: nil, pct: nil),
    Item(id: 4, age_s: 95, level: 3, kind: "research", ticker: nil, title: "Catch-down gauge: stage 1 to 2", body: "S&P 3.3% off its closing high: the index is starting to follow.", source: "Research", url: nil, pct: nil),
  ]
  let scale: CGFloat = 1.3, width = 440 * scale, gap: CGFloat = 10
  let views = samples.map { CardView(item: $0, width: width, scale: scale) }
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
let others = NSRunningApplication.runningApplications(withBundleIdentifier: Bundle.main.bundleIdentifier ?? "com.scintilla.notify").filter { $0 != NSRunningApplication.current }
if !others.isEmpty { exit(0) }
let delegate = App(); app.delegate = delegate; app.run()
