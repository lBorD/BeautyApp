function getTrimmedValue(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

export function getClientDisplayName(client) {
  return [getTrimmedValue(client?.name), getTrimmedValue(client?.lastName)]
    .filter(Boolean)
    .join(' ');
}

export function getClientInitials(client) {
  return [getTrimmedValue(client?.name), getTrimmedValue(client?.lastName)]
    .filter(Boolean)
    .map((name) => name.charAt(0).toUpperCase())
    .join('');
}

export function mergeUniqueAppointments(currentAppointments, nextAppointments) {
  const appointmentIds = new Set();
  const mergedAppointments = [];
  const appointments = [
    ...(Array.isArray(currentAppointments) ? currentAppointments : []),
    ...(Array.isArray(nextAppointments) ? nextAppointments : []),
  ];

  for (const appointment of appointments) {
    if (!appointment) {
      continue;
    }

    if (appointment.id === null || appointment.id === undefined) {
      mergedAppointments.push(appointment);
      continue;
    }

    if (!appointmentIds.has(appointment.id)) {
      appointmentIds.add(appointment.id);
      mergedAppointments.push(appointment);
    }
  }

  return mergedAppointments;
}
