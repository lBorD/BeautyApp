import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../constants/colors';
import {
  createTeamMember,
  listTeamMembers,
  updateTeamMember,
} from '../../services/private/teamAPI';

const MIN_PASSWORD_LENGTH = 6;
const emptyForm = { name: '', email: '', password: '' };

const getApiError = (error, fallback) => error.response?.data?.error || fallback;

// Secao so da dona: cadastrar a funcionaria que agenda, desativar e redefinir senha.
const TeamSection = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState(null);
  const [passwordMemberId, setPasswordMemberId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const loadMembers = async () => {
    setLoading(true);
    setLoadError('');

    try {
      setMembers(await listTeamMembers());
    } catch (error) {
      console.error('Erro ao carregar equipe:', error.response?.data || error.message);
      setLoadError('Não foi possível carregar a equipe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const replaceMember = (updated) => {
    setMembers((current) => current.map((member) => (member.id === updated.id ? updated : member)));
  };

  const closeForm = () => {
    setIsAdding(false);
    setForm(emptyForm);
    setFormError('');
  };

  const handleCreate = async () => {
    if (saving) {
      return;
    }

    const name = form.name.trim();
    const email = form.email.trim();

    if (!name || !email) {
      setFormError('Preencha nome e e-mail.');
      return;
    }

    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const created = await createTeamMember({ name, email, password: form.password });
      setMembers((current) => [...current, created]);
      closeForm();
    } catch (error) {
      console.error('Erro ao cadastrar funcionária:', error.response?.data || error.message);
      setFormError(getApiError(error, 'Não foi possível cadastrar agora.'));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (member, active) => {
    setBusyMemberId(member.id);

    try {
      replaceMember(await updateTeamMember(member.id, { active }));
    } catch (error) {
      console.error('Erro ao atualizar funcionária:', error.response?.data || error.message);
      Alert.alert('Erro', getApiError(error, 'Não foi possível atualizar agora.'));
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleToggleActive = (member) => {
    if (!member.active) {
      setActive(member, true);
      return;
    }

    Alert.alert(
      'Desativar acesso',
      `${member.name} deixa de entrar no app na hora. Os agendamentos que ela fez continuam com o nome dela.`,
      [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Desativar', style: 'destructive', onPress: () => setActive(member, false) },
      ],
    );
  };

  const openPasswordReset = (member) => {
    setPasswordMemberId(member.id);
    setNewPassword('');
    setPasswordError('');
  };

  const handleSavePassword = async (member) => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setBusyMemberId(member.id);

    try {
      await updateTeamMember(member.id, { password: newPassword });
      setPasswordMemberId(null);
      setNewPassword('');
      Alert.alert('Senha redefinida', `Passe a nova senha para ${member.name}.`);
    } catch (error) {
      console.error('Erro ao redefinir senha:', error.response?.data || error.message);
      setPasswordError(getApiError(error, 'Não foi possível redefinir agora.'));
    } finally {
      setBusyMemberId(null);
    }
  };

  const renderMember = (member) => {
    const isBusy = busyMemberId === member.id;
    const isResettingPassword = passwordMemberId === member.id;

    return (
      <View key={member.id} style={styles.memberRow}>
        <View style={styles.memberHeader}>
          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, !member.active && styles.inactiveText]} numberOfLines={1}>
              {member.name}
            </Text>
            <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text>
          </View>
          {isBusy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.memberStatus, !member.active && styles.inactiveText]}>
              {member.active ? 'Ativa' : 'Desativada'}
            </Text>
          )}
        </View>

        {isResettingPassword ? (
          <View style={styles.inlineForm}>
            <TextInput
              style={styles.input}
              placeholder="Nova senha"
              placeholderTextColor={colors.placeholder}
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
              secureTextEntry
              autoFocus
            />
            {Boolean(passwordError) && <Text style={styles.errorText}>{passwordError}</Text>}
            <View style={styles.inlineActions}>
              <TouchableOpacity onPress={() => setPasswordMemberId(null)} disabled={isBusy}>
                <Text style={styles.linkMuted}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSavePassword(member)} disabled={isBusy}>
                <Text style={styles.link}>Salvar senha</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.inlineActions}>
            {member.active && (
              <TouchableOpacity onPress={() => openPasswordReset(member)} disabled={isBusy}>
                <Text style={styles.link}>Redefinir senha</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => handleToggleActive(member)} disabled={isBusy}>
              <Text style={member.active ? styles.linkDanger : styles.link}>
                {member.active ? 'Desativar' : 'Reativar'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="people" size={22} color={colors.primary} />
        <Text style={styles.sectionTitle}>Equipe</Text>
      </View>
      <Text style={styles.helperText}>
        Quem você cadastrar aqui entra com o próprio e-mail, vê sua agenda e pode agendar. Financeiro e Google ficam só com você.
      </Text>

      {loading && <ActivityIndicator style={styles.loader} size="small" color={colors.primary} />}
      {!loading && Boolean(loadError) && (
        <TouchableOpacity onPress={loadMembers}>
          <Text style={styles.errorText}>{loadError} Tocar para tentar de novo.</Text>
        </TouchableOpacity>
      )}
      {!loading && !loadError && members.map(renderMember)}

      {isAdding ? (
        <View style={styles.inlineForm}>
          <TextInput
            style={styles.input}
            placeholder="Nome"
            placeholderTextColor={colors.placeholder}
            value={form.name}
            onChangeText={(name) => setForm((current) => ({ ...current, name }))}
            autoFocus
          />
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor={colors.placeholder}
            value={form.email}
            onChangeText={(email) => setForm((current) => ({ ...current, email }))}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Senha inicial"
            placeholderTextColor={colors.placeholder}
            value={form.password}
            onChangeText={(password) => setForm((current) => ({ ...current, password }))}
            autoCapitalize="none"
            secureTextEntry
          />
          {Boolean(formError) && <Text style={styles.errorText}>{formError}</Text>}
          <View style={styles.inlineActions}>
            <TouchableOpacity onPress={closeForm} disabled={saving}>
              <Text style={styles.linkMuted}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate} disabled={saving}>
              <Text style={styles.link}>{saving ? 'Salvando...' : 'Cadastrar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addButton} onPress={() => setIsAdding(true)} disabled={loading}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addButtonText}>Adicionar funcionária</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  helperText: {
    marginTop: 8,
    color: colors.darkGray,
    fontSize: 13,
    lineHeight: 18,
  },
  loader: {
    marginTop: 14,
  },
  memberRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  memberInfo: {
    flexShrink: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  memberEmail: {
    marginTop: 2,
    fontSize: 13,
    color: colors.darkGray,
  },
  memberStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  inactiveText: {
    color: colors.darkGray,
  },
  inlineForm: {
    marginTop: 12,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  inlineActions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  linkMuted: {
    color: colors.darkGray,
    fontWeight: '600',
    fontSize: 14,
  },
  linkDanger: {
    color: colors.error,
    fontWeight: '700',
    fontSize: 14,
  },
  errorText: {
    marginTop: 8,
    color: colors.error,
    fontSize: 13,
  },
  addButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 11,
  },
  addButtonText: {
    color: colors.primary,
    fontWeight: '700',
  },
});

export default TeamSection;
