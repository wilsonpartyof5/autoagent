//
//  DrevvyDealerApp.swift
//  DrevvyDealer
//
//  Created by mac on 9/11/26.
//

import SwiftUI

@main
struct DrevvyDealerApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var store = AppStore()
    @StateObject private var notificationRouter = NotificationManager.shared.router

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .environmentObject(notificationRouter)
        }
    }
}
