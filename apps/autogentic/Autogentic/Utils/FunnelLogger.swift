import Foundation

// MARK: - FunnelLogger
//
// Tracks the user journey through the app for debugging funnel drop-off.
// Only active in DEBUG builds. Zero overhead in production.
//
// Console output example:
//
//   ┌─ SESSION [A3F2] ───────────────────────────────────────────
//   │  +0ms     QUERY      "Find me trucks near Rock Hill SC"
//   │  +2ms     PARSE ▶    started
//   │  +1.2s    PARSE ✅   bodyType=Truck  location="Rock Hill, SC"
//   │  +1.3s    SEARCH ▶   source=chat  filters={bodyType:Truck}
//   │  +1.9s    SEARCH ✅  50 vehicles  roundtrip=600ms
//   │  +2.1s    RESULTS    50 shown — "Rock Hill, SC"
//   │  +45s     TAP        [#3] 2008 Chevrolet Silverado 1500  $6,995
//   │  +45s     DETAIL ▶   id=1GCEK14C98Z310116
//   │  +46s     DETAIL ✅  750ms — 14 photos  partial=false
//   └────────────────────────────────────────────────────────────

#if DEBUG

@MainActor
final class FunnelLogger {
    static let shared = FunnelLogger()
    private init() {}

    // MARK: - Session state

    private struct Session {
        let id: String
        let startTime: Date
        var searchCount: Int = 0
        var mapPanCount: Int = 0
        var tapCount: Int = 0
        var detailSuccessCount: Int = 0
        var detailFailCount: Int = 0
        var lastSearchSource: String = ""
    }

    private var current: Session?
    private var searchStart: Date?
    private var detailStart: Date?

    // MARK: - Public API

    /// Call when the user submits a query.
    func querySubmitted(_ text: String) {
        if let prev = current {
            printSummary(prev)
        }
        let newId = String(format: "%04X", Int.random(in: 0x0000...0xFFFF))
        current = Session(id: newId, startTime: Date())
        printHeader(newId)
        log("QUERY     ", "\"\(text)\"")
    }

    /// Call immediately before the NLP parse network request.
    func parseStarted() {
        log("PARSE ▶   ", "started")
    }

    /// Call when the parse response comes back successfully.
    func parseCompleted(filters: InventorySearchRequest.InventoryFilters?, location: String?, explicitFields: [String]) {
        var parts: [String] = []
        if let f = filters {
            if let bt = f.bodyType    { parts.append("bodyType=\(bt)") }
            if let mk = f.make        { parts.append("make=\(mk)") }
            if let md = f.model       { parts.append("model=\(md)") }
            if let mn = f.minPrice    { parts.append("minPrice=\(mn)") }
            if let mx = f.maxPrice    { parts.append("maxPrice=\(mx)") }
            if let my = f.minYear     { parts.append("minYear=\(my)") }
            if let xy = f.maxYear     { parts.append("maxYear=\(xy)") }
            if let mi = f.maxMiles    { parts.append("maxMiles=\(mi)") }
            if let co = f.condition   { parts.append("condition=\(co)") }
            if let yr = f.year        { parts.append("year=\(yr)") }
        }
        if let loc = location         { parts.append("location=\"\(loc)\"") }
        if !explicitFields.isEmpty    { parts.append("(\(explicitFields.count) explicit fields)") }
        let detail = parts.isEmpty ? "no filters, no location" : parts.joined(separator: "  ")
        log("PARSE ✅  ", detail)
    }

    /// Call when the parse request fails.
    func parseFailed(reason: String) {
        log("PARSE ❌  ", "reason=\(reason)")
    }

    /// Call when an inventory search API request is about to fire.
    func searchTriggered(source: String, filters: InventorySearchRequest.InventoryFilters?) {
        current?.searchCount += 1
        current?.lastSearchSource = source
        searchStart = Date()
        let filterDesc = describeFilters(filters)
        log("SEARCH ▶  ", "source=\(source)  \(filterDesc)")
    }

    /// Call when the search response arrives.
    func searchCompleted(vehicleCount: Int) {
        let ms = searchStart.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0
        log("SEARCH ✅ ", "\(vehicleCount) vehicles  roundtrip=\(ms)ms")
        searchStart = nil
    }

    /// Call when the search returns an error response.
    func searchFailed(reason: String) {
        let ms = searchStart.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0
        log("SEARCH ❌ ", "reason=\(reason)  roundtrip=\(ms)ms")
        searchStart = nil
    }

    /// Call after results are rendered in the UI.
    func resultsDisplayed(count: Int, locationName: String?) {
        let loc = locationName.map { "-- \"\($0)\"" } ?? ""
        log("RESULTS   ", "\(count) shown \(loc)")
    }

    /// Call when the user taps a vehicle card or map pin.
    func vehicleTapped(_ vehicle: Vehicle, listPosition: Int? = nil) {
        current?.tapCount += 1
        let pos = listPosition.map { "[#\($0)] " } ?? ""
        log("TAP       ", "\(pos)\(vehicle.year) \(vehicle.make) \(vehicle.model)  \(vehicle.formattedPrice)")
    }

    /// Call when VehicleDetailView appears and begins loading enrichment.
    func detailOpened(id: String) {
        detailStart = Date()
        let shortId = String(id.prefix(17))
        log("DETAIL ▶  ", "id=\(shortId)…")
    }

    /// Call when the enrichment response succeeds.
    func detailLoaded(photoCount: Int, partial: Bool) {
        current?.detailSuccessCount += 1
        let ms = detailStart.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0
        let partialNote = partial ? "  ⚠️ partial" : ""
        log("DETAIL ✅ ", "\(ms)ms — \(photoCount) photos\(partialNote)")
        detailStart = nil
    }

    /// Call when the enrichment request fails.
    func detailFailed(reason: String) {
        current?.detailFailCount += 1
        let ms = detailStart.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0
        log("DETAIL ❌ ", "\(ms)ms — \(reason)")
        detailStart = nil
    }

    /// Call when the map camera stops and triggers a new fetch.
    func mapPanned() {
        current?.mapPanCount += 1
    }

    // MARK: - Private helpers

    private func log(_ label: String, _ detail: String) {
        guard let session = current else { return }
        let elapsed = elapsedString(since: session.startTime)
        print("│  \(elapsed.padding(toLength: 9, withPad: " ", startingAt: 0)) \(label) \(detail)")
    }

    private func elapsedString(since start: Date) -> String {
        let ms = Int(Date().timeIntervalSince(start) * 1000)
        if ms < 1000 { return "+\(ms)ms" }
        let s = Double(ms) / 1000.0
        if s < 60 { return String(format: "+%.1fs", s) }
        return String(format: "+%.0fm%.0fs", floor(s / 60), s.truncatingRemainder(dividingBy: 60))
    }

    private func describeFilters(_ filters: InventorySearchRequest.InventoryFilters?) -> String {
        guard let f = filters, !f.isEmpty else { return "filters=none" }
        var parts: [String] = []
        if let bt = f.bodyType  { parts.append("bodyType=\(bt)") }
        if let mk = f.make      { parts.append("make=\(mk)") }
        if let md = f.model     { parts.append("model=\(md)") }
        if let mn = f.minPrice  { parts.append("minPrice=\(mn)") }
        if let mx = f.maxPrice  { parts.append("maxPrice=\(mx)") }
        if let my = f.minYear   { parts.append("minYear=\(my)") }
        if let xy = f.maxYear   { parts.append("maxYear=\(xy)") }
        if let mi = f.maxMiles  { parts.append("maxMiles=\(mi)") }
        if let yr = f.year      { parts.append("year=\(yr)") }
        return "filters={\(parts.joined(separator: ", "))}"
    }

    private func printHeader(_ id: String) {
        print("┌─ FUNNEL SESSION [\(id)] ─────────────────────────────────────────────")
    }

    private func printSummary(_ session: Session) {
        let total = Int(Date().timeIntervalSince(session.startTime))
        print("│")
        print("│  ── Session [\(session.id)] summary ─────────────────────────────")
        print("│     Duration     \(total)s")
        print("│     Searches     \(session.searchCount)  (map pans: \(session.mapPanCount))")
        print("│     Taps         \(session.tapCount)")
        print("│     Detail loads \(session.detailSuccessCount) ✅  \(session.detailFailCount) ❌")
        if session.tapCount > 0 && session.detailSuccessCount == 0 {
            print("│     ⚠️  DROP-OFF: \(session.tapCount) tap(s) but 0 detail loads succeeded")
        }
        if session.searchCount > 0 && session.tapCount == 0 {
            print("│     ⚠️  DROP-OFF: \(session.searchCount) search(es) but no vehicles tapped")
        }
        print("└────────────────────────────────────────────────────────────────────")
    }
}

#else

// Production stub — all calls compile away to nothing.
@MainActor
final class FunnelLogger {
    static let shared = FunnelLogger()
    private init() {}
    func querySubmitted(_ text: String) {}
    func parseStarted() {}
    func parseCompleted(filters: InventorySearchRequest.InventoryFilters?, location: String?, explicitFields: [String]) {}
    func parseFailed(reason: String) {}
    func searchTriggered(source: String, filters: InventorySearchRequest.InventoryFilters?) {}
    func searchCompleted(vehicleCount: Int) {}
    func searchFailed(reason: String) {}
    func resultsDisplayed(count: Int, locationName: String?) {}
    func vehicleTapped(_ vehicle: Vehicle, listPosition: Int? = nil) {}
    func detailOpened(id: String) {}
    func detailLoaded(photoCount: Int, partial: Bool) {}
    func detailFailed(reason: String) {}
    func mapPanned() {}
}

#endif
