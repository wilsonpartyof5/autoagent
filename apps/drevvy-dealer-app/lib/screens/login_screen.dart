import 'package:flutter/material.dart';

import '../desk_scope.dart';
import '../theme/dealer_theme.dart';
import '../widgets/primary_button.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  var _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    super.dispose();
  }

  void _sendLink() {
    final email = _email.text.trim();
    final looksLikeEmail = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email);
    if (!looksLikeEmail) {
      setState(() => _error = 'Enter a work email. Nothing is sent.');
      return;
    }
    setState(() {
      _error = null;
      _sent = true;
    });
  }

  void _continue() {
    if (!RegExp(r'^\d{6}$').hasMatch(_code.text.trim())) {
      setState(() => _error = 'Enter any 6 digits. No code is checked.');
      return;
    }
    DeskScope.of(context).signInDemo();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: DecoratedBox(
                decoration: DealerColors.cardDecoration(context),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            'DREVVY',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.4,
                              color: DealerColors.mutedOf(context),
                            ),
                          ),
                          const Spacer(),
                          const DealerThemeToggle(),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Desk',
                        style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Work email sign-in is a stub. Dealers see first name only. Chat is for transparency and answering questions. No message is sent, and no account is created.',
                        style: TextStyle(color: DealerColors.mutedOf(context), height: 1.4),
                      ),
                      const SizedBox(height: 20),
                      const Text('Work email', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                      const SizedBox(height: 6),
                      TextField(
                        key: const Key('work-email'),
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        autocorrect: false,
                        decoration: const InputDecoration(hintText: 'you@rooftop.example'),
                      ),
                      if (_sent) ...[
                        const SizedBox(height: 12),
                        Text(
                          'No email was sent. Enter any 6-digit code to open the demo inbox.',
                          style: TextStyle(color: DealerColors.mutedOf(context), height: 1.4),
                        ),
                        const SizedBox(height: 12),
                        const Text('One-time code', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                        const SizedBox(height: 6),
                        TextField(
                          key: const Key('otp-code'),
                          controller: _code,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(hintText: '123456'),
                        ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          _error!,
                          style: const TextStyle(
                            color: DealerColors.danger,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      PrimaryButton(
                        buttonKey: Key(_sent ? 'continue-demo' : 'send-link'),
                        label: _sent ? 'Continue to inbox' : 'Email me a link',
                        onPressed: _sent ? _continue : _sendLink,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
