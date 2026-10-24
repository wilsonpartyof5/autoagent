import 'package:flutter/material.dart';

import '../data/demo_desk.dart';
import '../desk_scope.dart';
import '../theme/dealer_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final _name = TextEditingController();
  late final _email = TextEditingController();
  late final _rooftop = TextEditingController(text: demoRooftopName);
  late final _docFee = TextEditingController(text: '$demoDocFeeDollars');
  var _newConversation = true;
  var _waiting = true;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _rooftop.dispose();
    _docFee.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        const SafeArea(
          bottom: false,
          child: Text('Settings', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        ),
        const SizedBox(height: 6),
        const Text(
          'Demo only. These fields stay on this page. Nothing is saved, and there is no dealer paywall.',
          style: TextStyle(color: DealerColors.muted, height: 1.4),
        ),
        const SizedBox(height: 16),
        _card(
          title: 'Profile',
          child: Column(
            children: [
              TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name', hintText: 'Your name')),
              const SizedBox(height: 8),
              TextField(controller: _email, decoration: const InputDecoration(labelText: 'Work email', hintText: 'Work email')),
            ],
          ),
        ),
        _card(
          title: 'Notifications',
          caption: 'Not connected.',
          child: Column(
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('New conversation'),
                value: _newConversation,
                onChanged: (value) => setState(() => _newConversation = value),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('A shopper is waiting on a reply'),
                value: _waiting,
                onChanged: (value) => setState(() => _waiting = value),
              ),
            ],
          ),
        ),
        _card(
          title: 'Store',
          caption: 'One demo rooftop. Multi-store is an open question. The doc fee is a default on this screen, not a quote.',
          child: Column(
            children: [
              TextField(controller: _rooftop, decoration: const InputDecoration(labelText: 'Rooftop')),
              const SizedBox(height: 8),
              TextField(
                controller: _docFee,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Doc fee default'),
              ),
            ],
          ),
        ),
        _card(
          title: 'Team',
          caption: 'Placeholder for managers and above. Who can share numbers, and how accounts are provisioned, are open questions.',
          child: const Column(
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('Dana Ruiz', style: TextStyle(fontWeight: FontWeight.w700)),
                trailing: Text('Manager'),
              ),
              Divider(height: 1),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('Sam Patel', style: TextStyle(fontWeight: FontWeight.w700)),
                trailing: Text('Salesperson'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: () => DeskScope.of(context).signOut(),
          child: const Text('Sign out'),
        ),
        const SizedBox(height: 8),
        const Text(
          'Returns to the demo login. There is no account yet.',
          style: TextStyle(color: DealerColors.muted, fontSize: 12),
        ),
      ],
    );
  }

  Widget _card({required String title, String? caption, required Widget child}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: DealerColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: DealerColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          if (caption != null) ...[
            const SizedBox(height: 4),
            Text(caption, style: const TextStyle(color: DealerColors.muted, fontSize: 12, height: 1.4)),
          ],
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}
