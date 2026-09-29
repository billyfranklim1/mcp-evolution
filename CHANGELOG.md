# Changelog

## 0.6.0

### BREAKING CHANGES

- **Dangerous tools are disabled by default.** They are only registered when named in
  `EVOLUTION_ALLOWED_TOOLS` (or enabled with the `@dangerous` group): `send_status`,
  `delete_message`, `update_privacy`, `update_profile_name`, `update_profile_status`,
  `update_profile_picture`, `remove_profile_picture`, `update_block_status`, `create_group`,
  `update_group_subject`, `update_group_description`, `update_group_picture`,
  `update_group_setting`, `update_participants`, `revoke_invite_code`, `accept_invite`,
  `leave_group`, `restart_instance`, `logout_instance`, `set_settings`, `set_webhook`.
  To restore the previous behaviour: `EVOLUTION_ALLOWED_TOOLS=@default,@dangerous`.
- Setting both `EVOLUTION_INSTANCE` and `EVOLUTION_INSTANCES` is a startup error.
- `find_messages` / `get_chat_history` now error on an unrecognised Evolution response
  instead of silently returning an empty list.

### Added

- Multiple instances: `EVOLUTION_INSTANCES` (comma list) and `EVOLUTION_DEFAULT_INSTANCE`.
  With more than one instance every tool accepts an optional `instance` (validated against the list).
- `list_instances` tool (names, default, optional connection state).
- `EVOLUTION_ALLOWED_TOOLS` with groups `@read`, `@send`, `@default`, `@dangerous`.
- `EVOLUTION_ALLOWED_RECIPIENTS` and per-instance `EVOLUTION_ALLOWED_RECIPIENTS__<INSTANCE>`;
  listing tools are filtered to the allowlist.
- Secret redaction (API key, Basic Auth, URL passwords) in every result/error sent to the client.

### Fixed

- `find_messages` / `get_chat_history` read Evolution v2 paginated envelopes (`messages.records`).
- `get_group_resolved_participants` scopes its DB query to the selected instance.
- Server reports the real package version.
