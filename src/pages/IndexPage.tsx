import { Link } from "react-router-dom";
import { useUserStore } from "../store/userStore";

export const IndexPage = () => {
  const user = useUserStore((state) => state.user);

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <h1 className="text-2xl font-bold">Головна сторінка</h1>
      {user ? (
        <p>Привіт, {user.first_name}!</p>
      ) : (
        <p>Користувача не знайдено (Мок/Браузер)</p>
      )}
      <Link to="/home" className="px-4 py-2 bg-blue-500 text-white rounded-lg">
        Перейти на Home
      </Link>
    </div>
  );
};
