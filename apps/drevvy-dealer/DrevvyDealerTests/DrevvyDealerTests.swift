//
//  DrevvyDealerTests.swift
//  DrevvyDealerTests
//
//  Created by mac on 9/11/26.
//

import Testing
@testable import DrevvyDealer

struct DrevvyDealerTests {

    @Test func balanceCountsIncludedAndPaidLeads() {
        let balance = BalanceSummary(
            cashBalanceCents: 6_000,
            includedLeadsRemaining: 3,
            leadPriceCents: 2_000,
            autoReplenishEnabled: false
        )

        #expect(balance.paidLeadsAvailable == 3)
        #expect(balance.totalLeadsAvailable == 6)
        #expect(balance.isLow == false)
    }

    @Test func balanceIsLowAtTwoLeads() {
        let balance = BalanceSummary(
            cashBalanceCents: 2_000,
            includedLeadsRemaining: 1,
            leadPriceCents: 2_000,
            autoReplenishEnabled: false
        )

        #expect(balance.totalLeadsAvailable == 2)
        #expect(balance.isLow)
    }

    @Test @MainActor func appStoreLoadsDealerData() async {
        let store = AppStore(api: DemoDealerAPI())

        await store.load()

        #expect(store.selectedDealership != nil)
        #expect(store.dashboard != nil)
        #expect(store.leads.count == 4)
        #expect(store.inventory.count == 5)
    }

    @Test @MainActor func leadStatusCanChange() async {
        let store = AppStore(api: DemoDealerAPI())
        await store.load()
        let leadID = try! #require(store.leads.first?.id)

        await store.updateStatus(for: leadID, to: .closed)

        #expect(store.lead(id: leadID)?.status == .closed)
    }

    @Test @MainActor func resendQueuesXMLDelivery() async {
        let store = AppStore(api: DemoDealerAPI())
        await store.load()
        let leadID = try! #require(store.leads.first?.id)

        await store.resend(leadID)

        #expect(store.lead(id: leadID)?.delivery.state == .pending)
        #expect(store.lead(id: leadID)?.delivery.message == "Queued for XML delivery")
    }

}
