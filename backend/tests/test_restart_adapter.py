"""Validation for deployment-aware runtime restart adapters.

These cover the command strings and the execute-gating that the operator UI and
the NAS install docs rely on, across docker-compose, systemd, supervisor,
Synology, QNAP, supervised-hook, disabled, and manual fallbacks.
"""

from collections.abc import Callable

import pytest

from app.config import settings
from app.services import runtime_settings as rs


def _configure(
    monkeypatch: pytest.MonkeyPatch,
    *,
    adapter: str = "auto",
    service_name: str = "",
    execute: bool = False,
    hook: str = "",
) -> None:
    monkeypatch.setattr(settings, "restart_adapter", adapter)
    monkeypatch.setattr(settings, "restart_service_name", service_name)
    monkeypatch.setattr(settings, "restart_adapter_execute", execute)
    monkeypatch.setattr(settings, "restart_hook_command", hook)


def _available(*names: str) -> Callable[[str], bool]:
    allowed = set(names)
    return lambda command_name: command_name in allowed


def test_disabled_adapter_is_manual(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, adapter="disabled")
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.adapter == "disabled"
    assert adapter.executable is False
    assert adapter.manual_required is True
    assert "CVN_RESTART_ADAPTER=disabled" in adapter.env_lines


def test_supervised_hook_takes_priority_and_is_executable(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, adapter="auto", hook="/opt/restart-channel-vault.sh")
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.adapter == "supervised-hook"
    assert adapter.command == "/opt/restart-channel-vault.sh"
    assert adapter.executable is True
    assert adapter.manual_required is False
    assert any("CVN_RESTART_HOOK_COMMAND=/opt/restart-channel-vault.sh" in line for line in adapter.env_lines)


def test_supervised_hook_preempts_an_explicit_adapter(monkeypatch: pytest.MonkeyPatch) -> None:
    # A configured hook wins over any non-disabled adapter (ordering guard).
    _configure(monkeypatch, adapter="systemd", service_name="channel-vault-nas-api", hook="/opt/restart.sh")
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.adapter == "supervised-hook"
    assert adapter.command == "/opt/restart.sh"


def test_disabled_wins_over_a_configured_hook(monkeypatch: pytest.MonkeyPatch) -> None:
    # Disabled is checked before the hook, so it stays manual even with a hook set.
    _configure(monkeypatch, adapter="disabled", hook="/opt/restart.sh")
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.adapter == "disabled"
    assert adapter.executable is False


def test_docker_compose_copy_only_without_execute(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, adapter="docker-compose", service_name="api", execute=False)
    monkeypatch.setattr(rs, "_command_available", _available("docker"))
    monkeypatch.setattr(rs, "_detect_compose_file", lambda: None)
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.adapter == "docker-compose"
    assert adapter.command == "docker compose restart api"
    assert adapter.executable is False
    assert adapter.manual_required is True


def test_docker_compose_executable_with_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, adapter="docker_compose", service_name="api", execute=True)
    monkeypatch.setattr(rs, "_command_available", _available("docker"))
    monkeypatch.setattr(rs, "_detect_compose_file", lambda: None)
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.adapter == "docker-compose"
    assert adapter.executable is True
    assert adapter.manual_required is False


def test_docker_compose_not_executable_when_cli_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, adapter="docker-compose", service_name="api", execute=True)
    monkeypatch.setattr(rs, "_command_available", _available())
    monkeypatch.setattr(rs, "_detect_compose_file", lambda: None)
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.command_available is False
    assert adapter.executable is False


def test_systemd_command_and_gating(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, adapter="systemd", service_name="channel-vault-nas-api", execute=True)
    monkeypatch.setattr(rs, "_command_available", _available("systemctl"))
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.adapter == "systemd"
    assert adapter.command == "systemctl restart channel-vault-nas-api"
    assert adapter.executable is True
    assert any(line.startswith("CVN_RESTART_") for line in adapter.env_lines)


def test_systemd_manual_without_service_name_uses_default(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, adapter="systemd", service_name="", execute=True)
    monkeypatch.setattr(rs, "_command_available", _available("systemctl"))
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.command == "systemctl restart channel-vault-nas"
    assert adapter.executable is False
    assert adapter.manual_required is True


def test_supervisor_command_and_gating(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, adapter="supervisor", service_name="cvn", execute=True)
    monkeypatch.setattr(rs, "_command_available", _available("supervisorctl"))
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.adapter == "supervisor"
    assert adapter.command == "supervisorctl restart cvn"
    assert adapter.executable is True


def test_synology_package_command(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, adapter="synology-package", service_name="ChannelVaultNAS", execute=True)
    monkeypatch.setattr(rs, "_command_available", _available("synopkg"))
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.adapter == "synology-package"
    assert adapter.command == "synopkg restart ChannelVaultNAS"
    assert adapter.executable is True


def test_qnap_package_copy_only_when_script_absent(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, adapter="qnap-package", service_name="channel-vault-nas", execute=True)
    monkeypatch.setattr(rs, "_qnap_package_command_available", lambda **_: False)
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.adapter == "qnap-package"
    assert adapter.command == "/etc/init.d/channel-vault-nas.sh restart"
    assert adapter.executable is False
    assert adapter.manual_required is True


def test_qnap_package_executable_when_script_present(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, adapter="qnap-package", service_name="channel-vault-nas", execute=True)
    monkeypatch.setattr(rs, "_qnap_package_command_available", lambda **_: True)
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.adapter == "qnap-package"
    assert adapter.executable is True


def test_auto_falls_back_to_manual(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, adapter="auto")
    monkeypatch.setattr(rs, "_detect_compose_file", lambda: None)
    monkeypatch.setattr(rs, "_looks_like_synology_nas", lambda: False)
    monkeypatch.setattr(rs, "_looks_like_qnap_nas", lambda: False)
    monkeypatch.delenv("SUPERVISOR_ENABLED", raising=False)
    adapter = rs.get_runtime_restart_adapter()
    assert adapter.adapter == "manual"
    assert adapter.manual_required is True
