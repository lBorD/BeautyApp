import { useEffect, useState } from 'react';
import { getAuthUser, getCachedAuthUser } from '../services/authStorage';

// Usuario logado (dona ou funcionaria). Depois do login ja esta em memoria,
// entao a primeira renderizacao ja sai com o papel certo.
const useSessionUser = () => {
  const [user, setUser] = useState(getCachedAuthUser);

  useEffect(() => {
    let isMounted = true;

    getAuthUser().then((storedUser) => {
      if (isMounted) {
        setUser(storedUser);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return user;
};

export default useSessionUser;
