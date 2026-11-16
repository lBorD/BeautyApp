import api from '../api';

// Rotas exclusivas da dona da conta.
export const listTeamMembers = async () => {
  const response = await api.get('/team/members');
  return response.data;
};

export const createTeamMember = async ({ name, email, password }) => {
  const response = await api.post('/team/members', { name, email, password });
  return response.data;
};

export const updateTeamMember = async (id, changes) => {
  const response = await api.patch(`/team/members/${id}`, changes);
  return response.data;
};
