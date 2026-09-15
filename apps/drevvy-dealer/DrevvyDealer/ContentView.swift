//
//  ContentView.swift
//  DrevvyDealer
//
//  Created by mac on 9/11/26.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        AppShell()
    }
}

#Preview {
    ContentView()
        .environmentObject(AppStore())
        .environmentObject(NotificationRouter())
}
