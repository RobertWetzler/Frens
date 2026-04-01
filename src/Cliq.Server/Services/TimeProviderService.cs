namespace Cliq.Server.Services;

public interface ITimeProviderService
{
    DateTime UtcNow { get; }
}

public sealed class UtcTimeProviderService : ITimeProviderService
{
    public DateTime UtcNow => DateTime.UtcNow;
}
